import json
import os
from collections import defaultdict

class EnterpriseAuditPipeline:
    def __init__(self):
        self.items = []
        self.seen_titles = defaultdict(list)
        self.seen_descriptions = defaultdict(list)
        self.internal_link_graph = defaultdict(int) 
        
        # STRICT THRESHOLDS (Scoring)
        self.limits = {
             "meta_title": (50, 60),
             "meta_desc": (150, 160),
        }

    def process_item(self, item, spider):
        # Buffer ALL items for Global Analysis
        
        # 1. Track Metadata for Duplicate Detection
        url = item.get('url')
        title = item.get('title', '')
        desc = item.get('meta_desc', '')
        
        if title: self.seen_titles[title].append(url)
        if desc: self.seen_descriptions[desc].append(url)
        
        # 2. Build Link Graph for Orphan Detection
        internal_links = item.get('links_internal', [])
        for link in internal_links:
            self.internal_link_graph[link] += 1
            
        self.items.append(item)
        return item

    def close_spider(self, spider):
        """
        POST-CRAWL ANALYSIS: 
        Calculates Orphans, Duplicates, Content Quality, and re-scores everything.
        """
        print(">>> [PIPELINE] Starting Post-Crawl Global Analysis...")
        
        # Retrieve broken links
        broken_report = getattr(spider, 'broken_link_report', [])
        broken_map = defaultdict(list)
        for report in broken_report:
            broken_map[report['origin']].append(report['broken_url'])

        # Iterate to apply Global Updates & STRICT SCORING
        for item in self.items:
            url = item.get('url')
            issues = item.get('audit_issues', [])
            
            # --- 1. GLOBAL CHECKS (Duplicates & Orphans) ---
            title = item.get('title', '')
            desc = item.get('meta_desc', '')
            
            if title and len(self.seen_titles[title]) > 1:
                item['is_duplicate_title'] = True
                issues.append({'severity': 'high', 'message': 'Duplicate Meta Title (Global)'})
            
            if desc and len(self.seen_descriptions[desc]) > 1:
                item['is_duplicate_desc'] = True
                issues.append({'severity': 'medium', 'message': 'Duplicate Meta Description (Global)'})

            incoming_count = self.internal_link_graph.get(url, 0)
            # Ignore orphans if it is the homepage (start_url)
            if incoming_count == 0 and url.rstrip('/') != spider.start_url.rstrip('/'):
                item['is_orphan'] = True
                issues.append({'severity': 'high', 'message': 'Orphan Page (0 Internal Links)'})
            else:
                item['is_orphan'] = False

            # --- 2. MERGE BROKEN LINKS ---
            broken_on_page = broken_map.get(url, [])
            if broken_on_page:
                item['broken_external_links'] = broken_on_page
                issues.append({'severity': 'critical', 'message': f'{len(broken_on_page)} Broken External Links Found'})

            # --- 2.5 STRICT CUSTOM 404 PENALTY ---
            # Checks the spider's probe. If False, penalize every page's overall health.
            has_custom_404 = getattr(spider, 'custom_404_active', True)
            if not has_custom_404:
                issues.append({'severity': 'medium', 'message': 'Missing Custom 404 Page (Returns generic server error)'})

            # --- 2.6 NEW: 5 ADVANCED SEMRUSH RULES (Pipeline Verification) ---
            # 1. Noindex Check
            if item.get('has_noindex'):
                issues.append({'severity': 'critical', 'message': 'Page contains a noindex tag.'})
                
            # 2. Viewport Check
            if item.get('missing_viewport'):
                issues.append({'severity': 'high', 'message': 'Missing Viewport Meta Tag.'})
                
            # 3. Hreflang Check
            if item.get('missing_hreflang'):
                issues.append({'severity': 'low', 'message': 'Missing hreflang tags for international SEO.'})
                
            # 4. Heading Hierarchy Logic
            headings = item.get('headings_hierarchy', [])
            if headings:
                levels = [int(h[1]) for h in headings if len(h) == 2 and h[1].isdigit()]
                for i in range(1, len(levels)):
                    if levels[i] - levels[i-1] > 1:
                        issues.append({'severity': 'medium', 'message': f'Heading hierarchy skipped from H{levels[i-1]} to H{levels[i]}.'})
                        break

            # 5. Dirty Sitemap Check
            status_code = item.get('status', 200)
            if item.get('from_sitemap') and (status_code >= 300 or status_code == 404 or item.get('has_noindex')):
                issues.append({'severity': 'high', 'message': 'Dirty Sitemap Detected (Contains non-200 or noindex URLs).'})
            # -----------------------------------------------------------------

            # --- 3. STRICT SCORING LOGIC (Hybrid Model) ---
            # Start at 100
            score = 100
            
            # A. Technical Penalties (Existing)
            for issue in issues:
                sev = issue.get('severity', 'low')
                if sev == 'critical': score -= 20
                elif sev == 'high': score -= 10
                elif sev == 'medium': score -= 5
                else: score -= 2
            
            # B. Content Quality Penalties (NEW - To punish empty sites)
            
            # 1. Readability Penalty
            readability = item.get('readability_score', 0)
            # If readability is missing (0) or very low, punish it.
            if readability < 50: 
                score -= 10
                issues.append({'severity': 'medium', 'message': 'Poor Readability Score (<50)'})
            
            # 2. Generic Title Penalty
            # New sites often use Home or My Site - strictly penalize this.
            if title and title.lower() in ['home', 'homepage', 'test', 'index', 'welcome', 'my site', 'new site']:
                score -= 15
                issues.append({'severity': 'high', 'message': 'Generic Page Title Detected'})

            # 3. Thin Content Penalty (Re-enforcing)
            # If Thin Content issue exists, ensure it hits the score hard
            # (It is already in the issues list from deep_crawl.py, but we ensure severity is HIGH)
            
            # C. Final Clamp
            final_score = max(0, min(100, score))
            
            item['audit_score'] = final_score
            item['audit_issues'] = issues
            
            # D. Stricter Labels
            if final_score >= 90: item['health_label'] = "Excellent"
            elif final_score >= 60: item['health_label'] = "Average" # Stricter average threshold
            else: item['health_label'] = "Poor"

        # --- 4. REWRITE JSONL FILE ---
        output_file = os.path.join(os.path.dirname(__file__), "crawl_result.jsonl")
        with open(output_file, 'w', encoding='utf-8') as f:
            for item in self.items:
                line = json.dumps(dict(item))
                f.write(line + "\n")
                
        print(f">>> [PIPELINE] Analysis Complete. Rewrote {len(self.items)} records.")
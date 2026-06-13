import scrapy
import re
import math
from urllib.parse import urlparse, urljoin, quote_plus
from seo_spider.items import SeoPageItem
from scrapy.utils.sitemap import Sitemap

class DeepCrawlSpider(scrapy.Spider):
    name = "deep_crawl"
    
    custom_settings = {
        'ROBOTSTXT_OBEY': False,          
        'DEPTH_LIMIT': 10,
        'CLOSESPIDER_PAGECOUNT': 0,
        'CONCURRENT_REQUESTS': 1, 
        'PLAYWRIGHT_MAX_CONTEXTS': 2,
        'PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT': 60000, 
        'DOWNLOAD_DELAY': 0.5,
        'RETRY_ENABLED': False, 
        # Catch 404s/500s so we can audit them (Internal & External)
        'HTTPERROR_ALLOWED_CODES': [404, 403, 500, 502, 503],
    }

    def __init__(self, start_url=None, *args, **kwargs):
        super(DeepCrawlSpider, self).__init__(*args, **kwargs)
        if not start_url: raise ValueError("start_url required")
        self.start_url = start_url.strip()
        if not self.start_url.startswith("http"): self.start_url = "https://" + self.start_url
        self.core_domain = urlparse(self.start_url).netloc.replace("www.", "")
        self.scanned_urls = set() 
        self.external_links_checked = set() 
        # To store broken links for global reporting
        self.broken_link_report = []

    def start_requests(self):
        # [STEP 1] Check Sitemap First.
        sitemap_url = urljoin(self.start_url, "/sitemap.xml")
        yield scrapy.Request(
            sitemap_url, 
            callback=self.step_1_check_sitemap, 
            errback=self.step_1_fallback,
            priority=100,
            meta={'is_sitemap_probe': True}
        )

        # Side Task: Probe for 404 handling (Excluded from stats)
        probe_url = urljoin(self.start_url, "/this-page-does-not-exist-audit-probe")
        yield scrapy.Request(
            probe_url, 
            meta={'playwright': False, 'is_probe': True}, 
            callback=self.parse_probe, 
            priority=10
        )

    # --- DAISY CHAIN LOGIC (Sitemap -> Robots -> Deep Crawl) ---

    def step_1_check_sitemap(self, response):
        """Step 1: Try to find a standard sitemap.xml"""
        if response.status == 200 and len(response.body) > 0:
            print(f">>> [CHAIN] Sitemap Found at {response.url}")
            requests = list(self.parse_sitemap_content(response))
            
            if len(requests) > 0:
                print(f">>> [CHAIN] STRICT MODE: Queuing {len(requests)} URLs. Deep discovery DISABLED.")
                self.crawler.stats.set_value('sitemap_present', True)
                self.crawler.stats.set_value('sitemap_count', len(requests))
                for req in requests:
                    yield req
            else:
                print(">>> [CHAIN] Sitemap empty or unparseable. Moving to Step 2...")
                yield from self.step_2_check_robots()
        else:
            print(">>> [CHAIN] Sitemap 404. Moving to Step 2...")
            yield from self.step_2_check_robots()

    def step_1_fallback(self, failure):
        print(">>> [CHAIN] Sitemap connection failed. Moving to Step 2...")
        yield from self.step_2_check_robots()

    def step_2_check_robots(self):
        """Step 2: Check robots.txt for a custom sitemap location"""
        robots_url = urljoin(self.start_url, "/robots.txt")
        yield scrapy.Request(
            robots_url, 
            callback=self.step_2_parse_robots, 
            errback=self.step_3_start_deep_crawl_wrapper, 
            priority=100
        )

    def step_2_parse_robots(self, response):
        sitemaps = re.findall(r'Sitemap:\s*(https?://\S+)', response.text, re.IGNORECASE)
        if sitemaps:
            print(f">>> [CHAIN] Sitemap found in Robots.txt: {sitemaps[0]}")
            # Loop back to Step 1 logic with the found URL
            yield scrapy.Request(
                sitemaps[0], 
                callback=self.step_1_check_sitemap, 
                errback=self.step_3_start_deep_crawl_wrapper,
                priority=100
            )
        else:
            print(">>> [CHAIN] No Sitemap in Robots.txt. Moving to Step 3 (Deep Discovery)...")
            yield from self.step_3_start_deep_crawl()

    def step_3_start_deep_crawl_wrapper(self, failure):
        return self.step_3_start_deep_crawl()

    def step_3_start_deep_crawl(self):
        """Step 3: Fallback to Deep Discovery (Crawling Links)"""
        print(">>> [CHAIN] Starting DEEP DISCOVERY on Homepage.")
        yield scrapy.Request(
            self.start_url,
            meta={
                'playwright': True,
                'playwright_include_page': True,
                'playwright_page_init_callback': self.init_page,
            },
            callback=self.parse_deep_discovery,
            errback=self.handle_audit_failure, 
            priority=100
        )

    # --- HELPERS ---
    def parse_sitemap_content(self, response):
        body = response.body
        s = Sitemap(body)
        if s.type == 'sitemapindex':
            for it in s:
                if 'loc' in it:
                    yield scrapy.Request(it['loc'], callback=self.step_1_check_sitemap, priority=100)
        else:
            for it in s:
                if 'loc' in it:
                    url = it['loc']
                    if self.core_domain in url: 
                        if url not in self.scanned_urls:
                            self.scanned_urls.add(url)
                            yield scrapy.Request(
                                url, 
                                meta={
                                    'playwright': True, 
                                    'playwright_include_page': True, 
                                    'playwright_page_init_callback': self.init_page,
                                    'from_sitemap': True # Tag added for pipeline checks
                                }, 
                                callback=self.parse_audit_only, # STRICT MODE CALLBACK
                                errback=self.handle_audit_failure, 
                                priority=50
                            )

    # --- WORKERS ---

    # WORKER A: Audit Only (Strict Mode - Sitemap Present)
    # Does NOT crawl links. Just audits the page and closes it.
    async def parse_audit_only(self, response):
        page = response.meta.get("playwright_page")
        
        if page:
            try: 
                # 1. Scroll to trigger lazy loading
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
                # 2. CRITICAL WAIT: Wait 2.0s for CLS/TBT to accumulate
                await page.wait_for_timeout(2000)
            except: pass
            
        item = await self.extract_data(response, page)
        yield item
        if page: await page.close()

    # WORKER B: Deep Discovery (No Sitemap Mode)
    # Audits the page AND aggressively finds new links.
    async def parse_deep_discovery(self, response):
        page = response.meta.get("playwright_page")
        is_html_mode = page is None

        # 1. INTERACTION (Clicking Buttons)
        if not is_html_mode:
            try:
                try: await page.wait_for_load_state("networkidle", timeout=10000)
                except: pass

                await page.evaluate("""async () => {
                    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                    window.scrollTo(0, document.body.scrollHeight);
                    await sleep(1000);
                    
                    // Click 'Next' / 'Load More' / 'Cards' to reveal content
                    for(let i=0; i<30; i++) { 
                        const btn = Array.from(document.querySelectorAll('button, a, div[role="button"], .pagination a'))
                            .find(el => {
                                const t = el.innerText?.toLowerCase() || "";
                                const aria = el.getAttribute('aria-label')?.toLowerCase() || "";
                                return t.includes('load more') || t.includes('show more') || t.includes('next') || aria.includes('next');
                            });
                        if(btn) { btn.click(); await sleep(800); } else break;
                    }
                }""")
                # Wait for Metrics after interactions
                await page.wait_for_timeout(2000)
            except: pass

        # 2. AUDIT
        item = await self.extract_data(response, page)
        yield item
        self.scanned_urls.add(response.url)

        # 3. DISCOVERY (Finding New Links)
        if not is_html_mode:
            try:
                # Priority A: Navbar, Header, Footer
                nav_links = await page.evaluate("""() => {
                    const containers = document.querySelectorAll('nav, header, footer, .menu, .navbar');
                    let urls = [];
                    containers.forEach(c => {
                        c.querySelectorAll('a[href]').forEach(a => urls.push(a.href));
                    });
                    return urls;
                }""")
                for url in nav_links:
                    for req in self.queue_url(url, response.url, priority=50): yield req
                
                # Priority B: Body Content (Cards, Grids)
                body_links = await page.evaluate("""() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href)""")
                for url in body_links:
                    for req in self.queue_url(url, response.url, priority=10): yield req
            except: pass
        
        # Fallback for HTML-only mode
        if is_html_mode:
            links = re.findall(r'href=["\'](https?://[^"\']+|/[^"\']+)["\']', response.text)
            for href in set(links):
                for req in self.queue_url(href, response.url, priority=10): yield req

        if page: await page.close()

    def queue_url(self, href, current_url, priority=0):
        if not href or len(href) < 2: return
        full_url = urljoin(current_url, href).split('#')[0].split('?')[0]
        try: parsed = urlparse(full_url)
        except: return
        
        if (self.core_domain in parsed.netloc):
            if full_url not in self.scanned_urls:
                # Filter out obvious non-html files
                if any(full_url.lower().endswith(x) for x in ['.pdf','.zip','.js','.css','.png','.jpg']): return
                if any(x in full_url.lower() for x in ['page=', '/property/', '/listing/', '/project/', '/product/']): priority = max(priority, 20)
                
                self.scanned_urls.add(full_url)
                # RECURSION: New links go back to 'parse_deep_discovery'
                yield scrapy.Request(
                    full_url,
                    meta={
                        'playwright': True,
                        'playwright_include_page': True,
                        'playwright_page_init_callback': self.init_page,
                    },
                    callback=self.parse_deep_discovery, 
                    errback=self.handle_audit_failure,
                    priority=priority
                )
        elif full_url.startswith('http') and full_url not in self.external_links_checked:
            self.external_links_checked.add(full_url)
            # CHECK EXTERNAL LINK (HEAD Request)
            yield scrapy.Request(
                full_url, 
                method='HEAD', 
                callback=self.parse_external_check, 
                errback=self.parse_external_check, 
                meta={'origin_url': current_url}, 
                priority=1
            )

    async def parse_probe(self, response):
        self.custom_404_active = (response.status == 404) and (len(response.body) > 500)

    async def handle_audit_failure(self, failure):
        request = failure.request
        yield scrapy.Request(request.url, meta={'playwright': False, 'is_fallback': True}, callback=self.parse_audit_only, dont_filter=True, priority=200)

    # --- 1. EXTERNAL LINK CHECKER ---
    def parse_external_check(self, response):
        """
        Catches broken external links (404/500).
        """
        origin_url = response.meta.get('origin_url')
        if response.status >= 400:
            print(f">>> [BROKEN LINK] {response.url} (Status: {response.status}) found on {origin_url}")
            # Store it so the Pipeline can merge it later
            self.broken_link_report.append({
                'broken_url': response.url,
                'origin': origin_url,
                'status': response.status
            })

    async def init_page(self, page, request):
        # Block media to speed up crawling
        await page.route("**/*.{png,jpg,jpeg,mp4,woff,woff2,css,svg,gif,webp}", lambda route: route.abort())
        # Inject Performance Observer for Accurate CLS/TBT
        await page.add_init_script("""
            window.__seo_metrics = { cls: 0, tbt: 0 };
            try {
                new PerformanceObserver((l) => l.getEntries().forEach(e => {
                    if (e.entryType === 'layout-shift' && !e.hadRecentInput) window.__seo_metrics.cls += e.value;
                    if (e.entryType === 'longtask') window.__seo_metrics.tbt += (e.duration - 50);
                })).observe({ type: 'layout-shift', buffered: true });
            } catch(e){}
        """)

    # --- 2. UPDATED: WEB-FRIENDLY READABILITY CALCULATOR ---
    def calculate_readability(self, text):
        if not text: return 0
        words = text.split()
        total_words = len(words)
        
        # Count standard punctuation
        total_sentences = text.count('.') + text.count('!') + text.count('?')
        
        # WEB FIX: If a page is mostly UI (navbars, cards) lacking periods, 
        # assume an average of 10 words per UI sentence to prevent math errors.
        if total_sentences < (total_words / 20):
            total_sentences = max(1, total_words / 10)
            
        total_syllables = sum([len(re.findall(r'[aeiouy]+', word.lower())) for word in words])
        
        if total_words == 0: return 0
        
        # Flesch Reading Ease Score
        score = 206.835 - 1.015 * (total_words / total_sentences) - 84.6 * (total_syllables / total_words)
        return max(0, min(100, int(score)))

    # --- 3. GOOGLE SERP MATCH (Async Playwright) ---
    async def check_serp_match(self, page, title, url):
        # NOTE: This uses Google Search query "site:url"
        query = f"site:{url}"
        search_url = f"https://www.google.com/search?q={quote_plus(query)}"
        
        try:
            # Open new tab for Google to avoid messing up main audit page
            serp_page = await page.context.new_page()
            await serp_page.goto(search_url, timeout=10000)
            
            # Extract the first title result
            serp_title = await serp_page.evaluate("""() => {
                const h3 = document.querySelector('h3');
                return h3 ? h3.innerText : "";
            }""")
            
            await serp_page.close()
            
            is_match = False
            if serp_title and title:
                # Fuzzy match: Google often truncates or appends brand names
                is_match = (title in serp_title) or (serp_title in title)
            
            return serp_title, is_match
        except:
            return "Check Failed (Blocked)", False

    # --- STRICT AUDIT & DATA EXTRACTION ---
    async def extract_data(self, response, page):
        item = SeoPageItem()
        item['url'] = response.url 
        item['status'] = response.status
        item['audit_issues'] = []
        item['links_external'] = []
        item['links_internal'] = [] 
        
        # 1. METADATA
        title = response.xpath("//title/text()").get() or ""
        desc = response.xpath("//meta[@name='description']/@content").get() or ""
        h1s = response.xpath("//h1")
        canonical = response.xpath("//link[@rel='canonical']/@href").get()
        og_url = response.xpath("//meta[@property='og:url']/@content").get()
        
        item['title'] = title
        item['meta_desc'] = desc
        item['h1_count'] = len(h1s)
        item['canonical'] = canonical
        item['og_url'] = og_url

        # Rules
        if not title: item['audit_issues'].append({'severity': 'high', 'message': 'Missing Meta Title'})
        elif not (50 <= len(title) <= 60): item['audit_issues'].append({'severity': 'medium', 'message': f'Title length {len(title)} chars (Target: 50-60)'})

        if not desc: item['audit_issues'].append({'severity': 'medium', 'message': 'Missing Meta Description'})
        elif not (150 <= len(desc) <= 160): item['audit_issues'].append({'severity': 'medium', 'message': f'Description length {len(desc)} chars (Target: 150-160)'})

        if len(h1s) == 0: item['audit_issues'].append({'severity': 'high', 'message': 'Missing H1 Tag'})
        elif len(h1s) > 1: item['audit_issues'].append({'severity': 'high', 'message': f'Multiple H1 Tags Found ({len(h1s)})'})

        if response.url.startswith("http://"): item['audit_issues'].append({'severity': 'critical', 'message': 'Insecure Protocol (HTTP). Use HTTPS.'})
        if not canonical: item['audit_issues'].append({'severity': 'high', 'message': 'Missing Canonical Tag'})
        if not og_url: item['audit_issues'].append({'severity': 'low', 'message': 'Missing Open Graph URL'})

        # 2. IMAGES (Alt & Size Check)
        imgs = response.xpath("//img")
        missing_alt = 0
        for img in imgs:
            if not img.xpath("@alt").get(): missing_alt += 1
        if missing_alt > 0: item['audit_issues'].append({'severity': 'medium', 'message': f'{missing_alt} Images missing Alt Text'})

        # 3. READABILITY SCORE (UPDATED TO IGNORE SCRIPTS/STYLES)
        body_text = ""
        if page:
            try:
                # Playwright innerText natively ignores <script> and <style> and gets human-readable text
                body_text = await page.evaluate("document.body.innerText")
            except: pass
            
        if not body_text:
            # Fallback if Playwright fails: Exclude scripts and styles manually
            body_text = " ".join(response.xpath("//body//*:not(self::script):not(self::style)/text()").getall())

        # Treat visual line breaks (like menus/headers) as sentence periods for the formula
        clean_text = re.sub(r'\n+', '. ', body_text)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        
        item['readability_score'] = self.calculate_readability(clean_text)
        
        if item['readability_score'] < 60:
            item['audit_issues'].append({'severity': 'medium', 'message': f'Low Readability Score: {item["readability_score"]} (Target: >60)'})

        # 4. CONTENT & SCHEMA
        word_count = len(re.findall(r'\w+', clean_text))
        if word_count < 300:
            item['audit_issues'].append({'severity': 'medium', 'message': f'Thin Content: {word_count} words (Target > 300)'})

        if "application/ld+json" not in response.text.lower(): item['audit_issues'].append({'severity': 'medium', 'message': 'Missing Schema Markup'})
        socials = ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com']
        item['has_social_links'] = any(s in response.text.lower() for s in socials)
        if not item['has_social_links']: item['audit_issues'].append({'severity': 'low', 'message': 'No Social Links found'})

        # --- 4.5 NEW: EXTRACT ADVANCED SEMRUSH RULES ---
        item['has_noindex'] = bool(response.css('meta[name="robots"][content*="noindex"]').get())
        item['missing_viewport'] = not bool(response.css('meta[name="viewport"]').get())
        item['missing_hreflang'] = not bool(response.css('link[hreflang]').get())
        item['headings_hierarchy'] = response.css('h1, h2, h3, h4, h5, h6').xpath('name()').getall()
        item['from_sitemap'] = response.meta.get('from_sitemap', False)
        # -----------------------------------------------

        # 5. METRICS (Web Vitals + Image Size Limit)
        item['mobile'] = {'lcp': 0, 'fcp': 0, 'cls': "0", 'tbt': 0, 'speedIndex': 0}
        
        if page:
            try:
                # A. Internal/External Link Extraction (For Orphans/Broken Checks)
                links = await page.evaluate("""() => {
                    const internal = [];
                    const external = [];
                    document.querySelectorAll('a[href]').forEach(a => {
                        if (a.hostname === window.location.hostname) internal.push(a.href);
                        else external.push(a.href);
                    });
                    return { internal: [...new Set(internal)], external: [...new Set(external)] };
                }""")
                item['links_internal'] = links['internal']
                item['links_external'] = links['external']

                # B. Performance Metrics
                metrics = await page.evaluate("""() => {
                    const paint = performance.getEntriesByType('paint');
                    const nav = performance.getEntriesByType('navigation')[0];
                    const fcpEntry = paint.find(p => p.name === 'first-contentful-paint');
                    const fcp = fcpEntry ? fcpEntry.startTime : 0;
                    const lcp = fcp * 1.5; 
                    
                    // Check Image Sizes (Limit 200KB)
                    let largeImages = 0;
                    performance.getEntriesByType('resource').forEach(res => {
                        if (res.initiatorType === 'img' && res.encodedBodySize > 204800) { 
                            largeImages++;
                        }
                    });

                    // Calculate TTFB
                    const ttfb = nav ? (nav.responseStart - nav.requestStart) : 0;

                    return { 
                        lcp: lcp, fcp: fcp, ttfb: ttfb,
                        tbt: window.__seo_metrics.tbt || 0, 
                        cls: window.__seo_metrics.cls || 0,
                        largeImages: largeImages
                    };
                }""")
                
                # Check Image Limit
                if metrics['largeImages'] > 0:
                    item['audit_issues'].append({'severity': 'medium', 'message': f"{metrics['largeImages']} Images exceed 200KB limit"})

                lcp = int(metrics['lcp'])
                fcp = int(metrics['fcp'])
                tbt = int(metrics['tbt'])
                cls = float(metrics['cls'])
                ttfb = int(metrics['ttfb'])
                
                item['mobile'] = {
                    'lcp': lcp, 
                    'fcp': fcp, 
                    'cls': f"{cls:.2f}", 
                    'tbt': tbt, 
                    'speedIndex': int(fcp * 1.2)
                }
                
                # Strict Performance Thresholds
                if ttfb > 600: item['audit_issues'].append({'severity': 'high', 'message': f'Slow Server Response (TTFB): {ttfb}ms (>600ms)'})
                if lcp > 2500: item['audit_issues'].append({'severity': 'high', 'message': f'Slow LCP: {lcp}ms (>2.5s)'})
                if fcp > 1800: item['audit_issues'].append({'severity': 'medium', 'message': f'Slow FCP: {fcp}ms (>1.8s)'})
                if tbt > 200: item['audit_issues'].append({'severity': 'high', 'message': f'High Blocking Time: {tbt}ms (>200ms)'})
                if cls > 0.1: item['audit_issues'].append({'severity': 'high', 'message': f'Layout Shift: {cls:.2f} (>0.1)'})

            except: pass

        # --- 6. GOOGLE PAGESPEED INSIGHTS (0-100 Lighthouse Score) ---
        # NOTE: Replace 'YOUR_API_KEY_HERE' with your free Google API Key
        PSI_API_KEY = "AIzaSyDmGpIz9vud5mjaYgjyuYCJKLIiaKEA1j8"
        item['mobile_pagespeed'] = 'N/A'
        
        # Only run if you have entered an API key
        if PSI_API_KEY != "AIzaSyDmGpIz9vud5mjaYgjyuYCJKLIiaKEA1j8" and page:
            try:
                # Ask Google API for the Mobile Performance Score
                psi_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={quote_plus(response.url)}&strategy=mobile&category=performance&key={PSI_API_KEY}"
                
                # Use Playwright's async API context to prevent blocking the spider
                api_response = await page.context.request.get(psi_url, timeout=12000)
                
                if api_response.ok:
                    psi_data = await api_response.json()
                    # Google returns a decimal (e.g. 0.85). Multiply by 100 to get 85.
                    score = int(psi_data['lighthouseResult']['categories']['performance']['score'] * 100)
                    item['mobile_pagespeed'] = score
                    
                    # Apply your strict SEMrush-aligned rule
                    if score < 75:
                        item['audit_issues'].append({'severity': 'high', 'message': f'Google Mobile PageSpeed is {score}/100 (Target: >=75)'})
            except Exception as e:
                pass # Fail silently if Google rate-limits the request

        # Scoring
        base_score = 100
        for i in item['audit_issues']:
            if i['severity'] == 'critical': base_score -= 10
            elif i['severity'] == 'high': base_score -= 5
            elif i['severity'] == 'medium': base_score -= 2
            elif i['severity'] == 'low': base_score -= 1
        
        item['audit_score'] = max(0, base_score)
        if item['audit_score'] >= 90: item['health_label'] = "Excellent"
        elif item['audit_score'] >= 50: item['health_label'] = "Average"
        else: item['health_label'] = "Poor"
        
        # Redirect Check
        redirects = response.meta.get('redirect_urls', [])
        item['redirect_chain'] = redirects
        item['redirect_count'] = len(redirects)
        if len(redirects) > 1: item['audit_issues'].append({'severity': 'high', 'message': f'Redirect Chain Detected ({len(redirects)} hops)'})

        return item
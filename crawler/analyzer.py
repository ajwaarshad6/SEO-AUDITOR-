import os
import json
import requests
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util
from sklearn.feature_extraction.text import TfidfVectorizer

# API Key injected directly into the environment
os.environ["OPEN_PAGERANK_KEY"] = "so8ko0socw80w8wkw8wok8c4s0ocwkgg8cks000c"

app = FastAPI()

print("Loading Sentence-Transformer Model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model Loaded.")

def get_off_page_authority(domains):
    api_key = os.environ.get("OPEN_PAGERANK_KEY")
    if not api_key:
        return {d: 0 for d in domains}
        
    url = "https://openpagerank.com/api/v1.0/getPageRank"
    headers = {"API-OPR": api_key}
    
    query_string = "&".join([f"domains[]={d}" for d in domains])
    full_url = f"{url}?{query_string}"
    
    try:
        response = requests.get(full_url, headers=headers, timeout=10)
        data = response.json()
        
        results = {}
        for item in data.get("response", []):
            domain = item.get("domain")
            rank = item.get("page_rank_decimal", 0)
            
            results[domain] = float(rank) * 10 
            
        return results
    except Exception:
        return {d: 0 for d in domains}

class AnalyzeRequest(BaseModel):
    target_domain: str
    file_path: str

def clean_domain_name(domain_str):
    """Strips all protocols and paths to ensure exact domain matching"""
    return domain_str.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]

def extract_niche_and_keywords(text_corpus):
    if not text_corpus.strip():
        return "General Business & Services", []
        
    vectorizer = TfidfVectorizer(stop_words='english', max_features=25, ngram_range=(1, 2))
    try:
        tfidf_matrix = vectorizer.fit_transform([text_corpus])
        feature_names = vectorizer.get_feature_names_out()
        scores = tfidf_matrix.toarray()[0]
        
        keywords = sorted(zip(feature_names, scores), key=lambda x: x[1], reverse=True)
        top_keywords = [{"keyword": k[0].title(), "vol": int(k[1]*100)} for k in keywords[:5]]
        
        niche_words = " ".join([k[0] for k in keywords[:12]]).lower()
        
        # Scikit-Learn Dynamic Categorization Matrix (REFINED FOR FINTECH)
        niche_map = {
            "Sports & Recreation": ['padel', 'sports', 'court', 'tennis', 'racket', 'club', 'gym', 'fitness', 'workout', 'athlete'],
            "Real Estate & Property": ['property', 'real estate', 'dubai', 'villa', 'realty', 'broker', 'estate', 'apartment', 'housing'],
            "Digital Marketing & Agency": ['marketing', 'agency', 'campaign', 'seo', 'advertising', 'social media', 'lead generation', 'content'],
            "FinTech & Digital Payments": ['payment', 'wallet', 'fintech', 'crypto', 'transfer', 'card', 'bank', 'banking', 'deposit', 'withdrawal', 'pay', 'transaction', 'remittance'],
            "Technology & Software": ['software', 'tech', 'data', 'app', 'cyber', 'cloud', 'saas', 'development', 'it services'],
            "E-Commerce & Retail": ['shop', 'store', 'cart', 'buy', 'product', 'sale', 'checkout', 'shipping', 'retail', 'marketplace', 'ecommerce', 'price', 'electronics', 'brand', 'laptop', 'computer', 'accessories', 'stock', 'warranty'],
            "Corporate Consulting & Finance": ['consulting', 'business', 'setup', 'finance', 'offshore', 'corporate', 'tax', 'wealth', 'investment', 'audit'],
            "Healthcare & Medical": ['health', 'medical', 'hospital', 'clinic', 'care', 'doctor', 'patient', 'dental', 'surgery', 'pharmacy'],
            "Signage & Industrial Printing": ['signage', 'printing', 'digital printing', 'acrylic', 'glass', 'display', 'laser', 'inkjet', 'vinyl', 'banner', 'pvc', 'sheet', 'board', 'graphics', 'plotter', 'machine', 'equipment'],
            "Education & Learning": ['education', 'school', 'university', 'college', 'course', 'learn', 'student', 'academy', 'training', 'tutor'],
            "Travel & Hospitality": ['travel', 'hotel', 'resort', 'flight', 'tour', 'trip', 'holiday', 'booking', 'tourism'],
            "Legal Services": ['law', 'legal', 'attorney', 'lawyer', 'court', 'justice', 'litigation', 'firm'],
            "Construction & Industrial": ['construction', 'builder', 'industrial', 'manufacturing', 'engineering', 'machinery', 'logistics', 'supply']
        }
        
        niche = "General Business & Services"
        max_matches = 0
        
        for category, words in niche_map.items():
            matches = sum(1 for w in words if w in niche_words)
            if matches > max_matches:
                max_matches = matches
                niche = category
                
        return niche, top_keywords
    except Exception:
        return "General Business & Services", []

@app.post("/analyze")
async def analyze_competitors(request: AnalyzeRequest):
    if not os.path.exists(request.file_path):
         raise HTTPException(status_code=404, detail="Scraped data not found")

    with open(request.file_path, 'r', encoding='utf-8') as f:
        try:
            scraped_pages = json.load(f)
        except json.JSONDecodeError:
            scraped_pages = []

    clean_target = clean_domain_name(request.target_domain)

    if not scraped_pages:
        return generate_fallback_response(clean_target)

    scraped_pages.sort(key=lambda x: len(x.get('url', '')))
    df = pd.DataFrame(scraped_pages)
    
    domain_stats = {}
    for domain, group in df.groupby('domain'):
        full_text = " ".join(group['content_sample'].dropna().astype(str).tolist())
        niche, top_keywords = extract_niche_and_keywords(full_text)
        
        domain_embedding = model.encode(full_text[:5000])
        
        domain_stats[domain] = {
            'pages_crawled': len(group),
            'avg_words': int(group['word_count'].mean()),
            'total_internal': int(group['internal_links'].sum()),
            'total_external': int(group['external_links'].sum()), 
            'avg_h1': int(group['h1_count'].mean()),
            'avg_h2': int(group['h2_count'].mean()),
            'schema_usage': group['has_schema'].mean() * 100,
            'embedding': domain_embedding,
            'niche': niche,
            'keywords': top_keywords
        }

    competitors = []
    target_embedding = domain_stats.get(clean_target, {}).get('embedding', None)
    
    unique_domains = list(domain_stats.keys())
    if clean_target not in unique_domains:
        unique_domains.append(clean_target)
    off_page_scores = get_off_page_authority(unique_domains)

    for domain, stats in domain_stats.items():
        is_target = (domain == clean_target)
        
        content_score = min(100, int((stats['avg_words'] / 1000) * 50 + (min(stats['pages_crawled'], 500) / 500) * 50))
        tech_score = min(100, int((stats['schema_usage']) * 0.5 + (25 if stats['avg_h1'] >= 1 else 0) + (25 if stats['avg_h2'] >= 1 else 0)))
        
        on_page_auth = min(100, int((stats['total_internal'] / max(1, stats['pages_crawled'])) / 30 * 100))
        backlink_score = off_page_scores.get(domain, 0)
        auth_score = int((on_page_auth * 0.4) + (backlink_score * 0.6))
        
        overall = int((content_score + tech_score + auth_score) / 3)
        
        similarity = 100
        if not is_target and target_embedding is not None:
            similarity = int(util.cos_sim(target_embedding, stats['embedding'])[0][0].item() * 100)

        competitors.append({
            "domain": domain,
            "isTarget": is_target,
            "classification": "Dominant" if overall >= 70 else "Strong" if overall >= 50 else "Weak",
            "scores": {
                "authority": auth_score, "content": content_score, "technical": tech_score,
                "seo": similarity, "market": int(overall * 0.9), "overall": overall
            },
            "backlinkScore": int(backlink_score),
            "keyStrengths": ["Strong Topical Depth"] if content_score > 60 else ["Technical SEO compliance"] if tech_score > 70 else ["Good Authority"] if auth_score > 50 else [],
            "keyWeaknesses": ["Thin Content Profile"] if content_score < 40 else ["Poor Link Profile"] if auth_score < 40 else ["Missing H-Tags"] if tech_score < 40 else [],
            "wordCount": stats['avg_words'],
            "internalLinks": int(stats['total_internal'] / max(1, stats['pages_crawled'])),
            "externalLinks": int(stats['total_external'] / max(1, stats['pages_crawled'])),
            "h1Count": stats['avg_h1'], "h2Count": stats['avg_h2'], "h3Count": 0,
            "topKeywords": stats['keywords'],
            "intent": "Commercial",
            "niche": stats['niche'],
            "total_pages": stats['pages_crawled']
        })

    target_data = next((c for c in competitors if c['isTarget']), None)
    if not target_data:
        backlink_score = off_page_scores.get(clean_target, 0)
        auth_score = int(backlink_score * 0.6)
        overall = int(auth_score / 3)
        
        target_data = {
            "domain": clean_target, "isTarget": True, "classification": "Weak",
            "scores": {"authority": auth_score, "content": 0, "technical": 0, "seo": 0, "market": 0, "overall": overall},
            "keyStrengths": [], "keyWeaknesses": ["Blocked Crawler (0 Pages)"],
            "wordCount": 0, "internalLinks": 0, "externalLinks": 0,
            "h1Count": 0, "h2Count": 0, "h3Count": 0,
            "topKeywords": [], "intent": "Unknown", "niche": "Unknown", "total_pages": 0
        }
        competitors.append(target_data)

    competitors.sort(key=lambda x: x['scores']['overall'], reverse=True)
    market_leader = competitors[0]['domain'] if competitors else "Unknown"
    
    leader_data = competitors[0]
    if leader_data['domain'] == target_data['domain'] and len(competitors) > 1:
        leader_data = competitors[1]

    gap_analysis = {
        "benchmark_domain": leader_data['domain'],
        "target_is_leader": market_leader == target_data['domain'],
        "content_depth_gap": target_data['wordCount'] - leader_data['wordCount'],
        "content_coverage_gap": target_data['total_pages'] - leader_data['total_pages'],
        "authority_gap": target_data['scores']['authority'] - leader_data['scores']['authority'],
        "technical_structure_gap": target_data['scores']['technical'] - leader_data['scores']['technical'],
        "internal_linking_gap": target_data['internalLinks'] - leader_data['internalLinks'],
        "topic_coverage_missing": [k['keyword'] for k in leader_data['topKeywords'] if k not in target_data['topKeywords']]
    }
    
    recommendations = {"shortTerm": [], "longTerm": []}
    
    if gap_analysis['technical_structure_gap'] < -10:
        recommendations["shortTerm"].append(f"Audit technical SEO: Your structural score is trailing by {abs(gap_analysis['technical_structure_gap'])} points. Fix H1/H2 hierarchy and missing schema.")
    elif target_data.get('h1Count', 0) < 1:
        recommendations["shortTerm"].append("Heading structure is weak. Ensure every core page has exactly one well-optimized H1 tag.")
        
    if gap_analysis['content_depth_gap'] < -100:
        recommendations["shortTerm"].append(f"Fix thin content: Add roughly {abs(gap_analysis['content_depth_gap'])} words of high-intent copy per page to compete with {leader_data['domain']}.")
    elif gap_analysis['internal_linking_gap'] < -3:
        recommendations["shortTerm"].append(f"Strengthen internal silos: Add at least {abs(gap_analysis['internal_linking_gap'])} more contextual internal links per page to distribute authority.")
        
    if not recommendations["shortTerm"]:
        recommendations["shortTerm"].append("On-page fundamentals are solid. Focus on optimizing existing high-traffic pages for higher CTR.")

    if gap_analysis['topic_coverage_missing']:
        missing_topics = ', '.join([t.title() for t in gap_analysis['topic_coverage_missing'][:3]])
        recommendations["longTerm"].append(f"Build new content clusters around missing semantic entities: {missing_topics}.")
        
    if gap_analysis['authority_gap'] < -15:
        recommendations["longTerm"].append(f"Scale off-page SEO: Launch a targeted link-building campaign to close the {abs(gap_analysis['authority_gap'])}-point authority gap.")
    elif target_data.get('backlinkScore', 0) < 3:
        recommendations["longTerm"].append(f"Your backlink profile is holding back organic growth. Prioritize acquiring high-DR backlinks in the {target_data['niche']} niche.")
        
    if gap_analysis['content_coverage_gap'] < -20:
        recommendations["longTerm"].append(f"Expand domain footprint: You need to publish roughly {abs(gap_analysis['content_coverage_gap'])} new high-quality pages to match market coverage.")
        
    if not recommendations["longTerm"]:
        recommendations["longTerm"].append("Defend your market leadership by consistently publishing thought leadership and acquiring tier-1 backlinks.")

    return {
        "niche": target_data['niche'],
        "marketLeader": market_leader,
        "market_leader": market_leader,
        "competitors": competitors,
        "gapAnalysis": gap_analysis,
        "recommendations": recommendations
    }

def generate_fallback_response(target_domain: str):
    return {
        "niche": "Unknown Domain", "marketLeader": target_domain, "market_leader": target_domain,
        "competitors": [{"domain": target_domain, "isTarget": True, "classification": "Weak", "scores": {"authority": 0, "content": 0, "technical": 0, "seo": 0, "market": 0, "overall": 0}, "keyStrengths": [], "keyWeaknesses": ["Site blocked crawler"], "wordCount": 0, "internalLinks": 0, "externalLinks": 0, "h1Count": 0, "h2Count": 0, "h3Count": 0, "topKeywords": [], "intent": "Unknown", "total_pages": 0}],
        "gapAnalysis": {"benchmark_domain": target_domain, "target_is_leader": True, "content_depth_gap": 0, "content_coverage_gap": 0, "authority_gap": 0, "technical_structure_gap": 0, "internal_linking_gap": 0, "topic_coverage_missing": []},
        "recommendations": {"shortTerm": ["Verify your domain allows bot crawling."], "longTerm": ["Set up custom user agents to bypass security."]}
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
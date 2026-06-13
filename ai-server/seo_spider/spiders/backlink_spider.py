import scrapy
from urllib.parse import urlencode, urlparse
from sentence_transformers import SentenceTransformer, util
import torch

class BingBacklinkSpider(scrapy.Spider):
    name = "bing_backlinks"
    
    # Simulate a real Chrome browser to avoid immediate blocking
    custom_settings = {
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'ROBOTSTXT_OBEY': False,
        'DOWNLOAD_DELAY': 3, # Slow down to avoid Bing Ban
        'CONCURRENT_REQUESTS': 1
    }

    def __init__(self, target_url=None, *args, **kwargs):
        super(BingBacklinkSpider, self).__init__(*args, **kwargs)
        self.target_domain = urlparse(target_url).netloc.replace("www.", "")
        
        # Load ML Model for Quality Check (Relevance)
        # We will compare the backlink text to the keyword "SEO and Web Development"
        self.ml_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.target_embedding = self.ml_model.encode("technology web development business services")

    def start_requests(self):
        # The Magic Query: link:domain.com -site:domain.com
        # This asks Bing: "Show me pages pointing to X, but exclude X itself"
        query = f"link:{self.target_domain} -site:{self.target_domain}"
        bing_url = f"https://www.bing.com/search?{urlencode({'q': query})}"
        
        yield scrapy.Request(bing_url, callback=self.parse_bing)

    def parse_bing(self, response):
        # Extract Organic Results from Bing HTML
        # Note: Bing changes class names often, but 'li.b_algo' is stable for now
        results = response.css('li.b_algo')
        
        found_backlinks = []

        for result in results:
            url = result.css('h2 a::attr(href)').get()
            snippet = result.css('p::text').get() or ""
            
            if url:
                # --- ML FEATURE: Backlink Quality Scoring ---
                # 1. Encode the snippet text found on Bing
                snippet_embedding = self.ml_model.encode(snippet)
                
                # 2. Calculate Similarity to our Target Topic
                score = util.cos_sim(self.target_embedding, snippet_embedding).item()
                quality_label = "High" if score > 0.4 else "Low/Spam"
                
                found_backlinks.append({
                    "source_url": url,
                    "snippet": snippet,
                    "relevance_score": round(score * 100, 2),
                    "quality": quality_label
                })

        yield {
            "type": "backlink_report",
            "target": self.target_domain,
            "total_found": len(found_backlinks),
            "backlinks": found_backlinks
        }

        # Pagination: Follow "Next" button on Bing
        next_page = response.css('a.sb_pagN::attr(href)').get()
        if next_page:
            yield response.follow(next_page, callback=self.parse_bing)
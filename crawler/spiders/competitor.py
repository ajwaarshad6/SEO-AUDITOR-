import sys
import asyncio
import re

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import scrapy
from scrapy.spiders import CrawlSpider, Rule
from scrapy.linkextractors import LinkExtractor
from bs4 import BeautifulSoup

def block_heavy_assets(request):
    if request.resource_type in ["image", "media", "font", "stylesheet", "other"]:
        return True
    if any(x in request.url.lower() for x in [".js", ".css", "_nuxt", "webpack", "analytics"]):
        return True
    return False

class CompetitorSpider(CrawlSpider):
    name = "competitor_spy"
    
    custom_settings = {
        "TWISTED_REACTOR": "twisted.internet.asyncioreactor.AsyncioSelectorReactor",
        "DOWNLOAD_HANDLERS": {
            "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        },
        "PLAYWRIGHT_BROWSER_TYPE": "chromium",
        "PLAYWRIGHT_LAUNCH_OPTIONS": {"headless": True, "timeout": 15000},
        "PLAYWRIGHT_ABORT_REQUEST": block_heavy_assets,
        "DEPTH_LIMIT": 0,             
        "CLOSESPIDER_PAGECOUNT": 0, # 0 = LIMITLESS CRAWL (Entire Website)
        "CONCURRENT_REQUESTS": 16,    
        "DOWNLOAD_DELAY": 0.25,        
        "ROBOTSTXT_OBEY": False,
        "RETRY_ENABLED": True,
        "RETRY_TIMES": 1,
        "USER_AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    }

    # Centralized Deny Lists to prevent ALL infinite loops and media files
    DENY_PATTERNS = [
        r"/events/", r"/calendar/", r"\?tribe", r"\?ical", r"\?replytocom", r"/day/", 
        r"/tag/", r"/category/", r"/page/", r"/author/", r"\?add-to-cart", 
        r"/product-category/", r"/product-tag/", 
        r"/wp-content/uploads/", r"\?attachment_id=", # Blocks WordPress media files
        r"/tr/", r"/ar/", r"/ru/", r"/fr/", r"/es/", r"/zh/" # Blocks translated versions of the site
    ]
    
    # Added modern image and document formats (webp, gif, avif, etc.)
    DENY_EXTENSIONS = [
        "pdf", "jpg", "jpeg", "png", "svg", "zip", "mp4", 
        "webp", "gif", "avif", "doc", "docx", "xls", "xlsx"
    ]

    # Deep Discovery Mode: Recursively follows all valid internal links
    rules = (
        Rule(
            LinkExtractor(
                deny=DENY_PATTERNS,
                deny_extensions=DENY_EXTENSIONS
            ), 
            callback="parse_page", 
            follow=True
        ),
    )

    def __init__(self, targets=None, *args, **kwargs):
        super(CompetitorSpider, self).__init__(*args, **kwargs)
        
        if targets:
            self.target_domains = []
            for t in targets.split(","):
                clean_d = t.strip().replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
                if clean_d:
                    self.target_domains.append(clean_d)
            
            self.allowed_domains = self.target_domains
            
            # Prioritize Sitemap first, then fallback to domain roots for Deep Discovery
            self.start_urls = []
            for domain in self.target_domains:
                self.start_urls.append(f"https://{domain}/sitemap.xml")
                self.start_urls.append(f"https://www.{domain}/sitemap.xml")
                self.start_urls.append(f"https://www.{domain}")
                self.start_urls.append(f"https://{domain}")

    def parse_start_url(self, response):
        # Phase 1: Sitemap Processing (With strict loop blocking)
        if "sitemap" in response.url or response.headers.get("Content-Type", b"").startswith(b"text/xml"):
            soup = BeautifulSoup(response.body, "xml")
            urls = [loc.text for loc in soup.find_all("loc")]
            for url in urls:
                url_lower = url.lower()
                
                # Manually enforce the deny rules so sitemaps don't sneak in junk URLs
                if any(re.search(pattern, url_lower) for pattern in self.DENY_PATTERNS):
                    continue
                
                if any(url_lower.endswith(f".{ext}") for ext in self.DENY_EXTENSIONS):
                    continue
                    
                yield scrapy.Request(url, callback=self.parse_page)
        # Phase 2: Deep Discovery Mode Fallback
        else:
            return self.parse_page(response)

    def parse_page(self, response):
        if not hasattr(response, "text"):
            return

        soup = BeautifulSoup(response.text, "lxml")
        
        raw_domain = response.url.split("/")[2].replace("www.", "")
        current_domain = raw_domain
        
        for t in self.target_domains:
            if t in raw_domain:
                current_domain = t
                break
        
        internal_links = 0
        external_links = 0
        for link in soup.find_all("a", href=True):
            href = link.get("href", "").lower()
            if href.startswith("/") or current_domain in href:
                internal_links += 1
            elif href.startswith("http"):
                external_links += 1

        for script in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            script.extract()
            
        visible_text = soup.get_text(separator=" ", strip=True)
        word_count = len(visible_text.split())
        
        title = soup.title.string if soup.title else ""
        meta_desc = soup.find("meta", attrs={"name": "description"})
        desc = meta_desc["content"] if meta_desc else ""

        yield {
            "url": response.url,
            "domain": current_domain,
            "title": title,
            "description": desc,
            "h1_count": len(soup.find_all("h1")),
            "h2_count": len(soup.find_all("h2")),
            "h3_count": len(soup.find_all("h3")),
            "word_count": word_count,
            "internal_links": internal_links,
            "external_links": external_links,
            "has_schema": bool(soup.find("script", type="application/ld+json")),
            "content_sample": visible_text[:1000] 
        }
import scrapy
from urllib.parse import quote

class BacklinkSpider(scrapy.Spider):
    name = "backlink_finder"
    
    # 1. Force Playwright settings specifically for this spider
    custom_settings = {
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'ROBOTSTXT_OBEY': False,
        'DOWNLOAD_DELAY': 2,
        'DOWNLOAD_HANDLERS': {
            "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        },
        'TWISTED_REACTOR': "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
    }
    
    ENGINES = {
        'google': {
            'url': 'https://www.google.com/search?q={query}&num=20&hl=en',
            'link_selector': 'div.g a::attr(href)', 
            'fallback': 'a[href^="http"]::attr(href)' 
        },
        'bing': {
            'url': 'https://www.bing.com/search?q={query}&first=1',
            'link_selector': 'li.b_algo h2 a::attr(href)',
            'fallback': '.b_title a::attr(href)'
        },
        'yahoo': {
            'url': 'https://search.yahoo.com/search?p={query}&b=1',
            'link_selector': 'h3.title a::attr(href)',
            'fallback': '.algo-sr a::attr(href)'
        }
    }

    def __init__(self, target=None, *args, **kwargs):
        super(BacklinkSpider, self).__init__(*args, **kwargs)
        self.target_domain = target
        self.query = quote(f'"{target}" -site:{target}')

    async def start(self):
        target_engines = ['google', 'bing', 'yahoo']
        print(f"[INFO] Starting Playwright Multi-Engine Crawl: {', '.join(target_engines)}")

        for engine_name in target_engines:
            config = self.ENGINES[engine_name]
            url = config['url'].format(query=self.query)
            
            yield scrapy.Request(
                url, 
                callback=self.parse_serp, 
                meta={
                    'engine': engine_name,
                    'playwright': True, # 2. THIS OPENS HEADLESS CHROME
                    'playwright_include_page': True 
                },
                dont_filter=True
            )

    def parse_serp(self, response):
        engine = response.meta['engine']
        config = self.ENGINES[engine]
        
        results = response.css(config['link_selector']).getall()
        
        if not results and config.get('fallback'):
             results = response.css(config['fallback']).getall()

        clean_links = []
        for url in results:
            if "google" not in url and "yahoo" not in url and "bing" not in url and "microsoft" not in url:
                if url.startswith('http') and "aclk" not in url: 
                    clean_links.append(url)

        print(f"[DEBUG] {engine.upper()} via Playwright found {len(clean_links)} candidates.")

        for link in clean_links:
            yield scrapy.Request(
                link, 
                callback=self.parse_page, 
                meta={
                    'playwright': True, # 3. Follow links using Headless Chrome
                    'handle_httpstatus_list': [403, 404, 500]
                }
            )

    def parse_page(self, response):
        try:
            target_links = response.css(f'a[href*="{self.target_domain}"]')
            
            for link in target_links:
                yield {
                    "source_url": response.url,
                    "source_title": response.css('title::text').get() or "No Title",
                    "target_url": link.css('::attr(href)').get(),
                    "anchor": (link.css('::text').get() or "Empty").strip(),
                    "engine_source": response.meta.get('engine', 'unknown'),
                    "found_date": "2026-02-28" 
                }
        except:
            pass
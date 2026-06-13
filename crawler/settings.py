# settings.py - Anti-Blocking & Deep Discovery Configuration

BOT_NAME = 'backlink_crawler'
SPIDER_MODULES = ['spiders']
NEWSPIDER_MODULE = 'spiders'

# --- STEALTH MODE SETTINGS ---

# 1. Enable the Fake User Agent middleware (Randomizes identity)
DOWNLOADER_MIDDLEWARES = {
    'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': None,
    'scrapy.downloadermiddlewares.retry.RetryMiddleware': None,
    #'scrapy_fake_useragent.middleware.RandomUserAgentMiddleware': 400,
    #'scrapy_fake_useragent.middleware.RetryUserAgentMiddleware': 401,
}

# 2. Add realistic headers (Make servers think we are a real browser)
DEFAULT_REQUEST_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
}

# 3. SLOW DOWN (Crucial for free scraping without getting IP banned)
# Note: Since we are doing deep crawls, keeping this at 1-3 seconds prevents you from crashing the competitor's server.
DOWNLOAD_DELAY = 1.5 
RANDOMIZE_DOWNLOAD_DELAY = True

# 4. Disable Cookies (Tracks bots via cookies)
COOKIES_ENABLED = False

# 5. Output Format
FEED_FORMAT = 'json'


# --- DEEP DISCOVERY & FULL DOMAIN CRAWL SETTINGS ---

# Remove page limits (0 means unlimited pages)
CLOSESPIDER_PAGECOUNT = 0

# Remove depth limits (0 means it will follow links infinitely deep into the site)
DEPTH_LIMIT = 0

# Number of concurrent requests to process simultaneously (Speeds up the deep crawl safely)
CONCURRENT_REQUESTS = 16

# Use asyncio reactor for better concurrency support
TWISTED_REACTOR = 'twisted.internet.asyncioreactor.AsyncioSelectorReactor'
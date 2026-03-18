# src/ai-server/seo_spider/settings.py

BOT_NAME = 'seo_spider'
SPIDER_MODULES = ['seo_spider.spiders']
NEWSPIDER_MODULE = 'seo_spider.spiders'

# --- WINDOWS STABILITY ---
CONCURRENT_REQUESTS = 1
DOWNLOAD_DELAY = 0.5
COOKIES_ENABLED = False

# --- PLAYWRIGHT ---
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
PLAYWRIGHT_LAUNCH_OPTIONS = {
    "headless": True,
    "timeout": 60000,
    "args": ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
}

# --- CRITICAL FIX: ENABLE PIPELINE ---
ITEM_PIPELINES = {
   'seo_spider.pipelines.EnterpriseAuditPipeline': 300,
}

# --- EXTENSIONS ---
EXTENSIONS = {
   'seo_spider.extensions.ProgressJsonLogger': 100,
}

ROBOTSTXT_OBEY = False 
LOG_LEVEL = 'INFO'
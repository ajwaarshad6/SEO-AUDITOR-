import sys
import asyncio
import os
from scrapy.cmdline import execute

# On Windows, Playwright requires the Proactor loop.
# We explicitly set this to avoid any confusion.
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# We install the Twisted reactor that works best with Scrapy+Playwright
if sys.platform == 'win32':
    try:
        from twisted.internet import asyncioreactor
        if 'twisted.internet.reactor' not in sys.modules:
            asyncioreactor.install()
    except Exception:
        pass

if __name__ == '__main__':
    sys.argv[0] = 'scrapy'
    sys.exit(execute())
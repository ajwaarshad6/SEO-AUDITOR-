import sys
import asyncio
import os

def apply_fix():
    """Forces Windows to use the correct Event Loop Policy to prevent crashes."""
    if sys.platform == 'win32':
        # Force the SelectorEventLoop (The only one that works with Playwright on Windows)
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
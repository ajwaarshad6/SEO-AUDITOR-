import sys
import asyncio

# --- ABSOLUTE WINDOWS FIX ---
# This forces the SelectorEventLoop for the entire package context.
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
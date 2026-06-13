import sys
import os
import asyncio
import subprocess
import json
import threading
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- FORCE PROACTOR FOR SERVER ---
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def stream_filter(process, log_file_path):
    """
    Reads the spider's output in real-time. 
    It writes valid logs to spider_output.log but DELETES the Windows errors.
    """
    with open(log_file_path, "w", encoding="utf-8") as log_file:
        # We merge stdout and stderr to catch everything
        for line in iter(process.stdout.readline, b''):
            decoded_line = line.decode('utf-8', errors='ignore')
            
            # --- THE FILTER ---
            # If the line contains the known Windows crash error, we SKIP it.
            if "AssertionError" in decoded_line:
                continue
            if "proactor_events.py" in decoded_line:
                continue
            if "_loop_writing" in decoded_line:
                continue
            if "assert f is self._write_fut" in decoded_line:
                continue

            # If it's a real log, write it to file and print to console
            log_file.write(decoded_line)
            log_file.flush()
            # Optional: Print to console if you want to see progress live
            sys.stdout.write(decoded_line) 

def run_spider(spider_name, args=None):
    output_file = os.path.join(BASE_DIR, "seo_spider", "crawl_result.jsonl")
    log_file = os.path.join(BASE_DIR, "spider_output.log")
    
    if spider_name == "bing_backlinks":
        output_file = os.path.join(BASE_DIR, "seo_spider", "backlinks.jsonl")

    if os.path.exists(output_file):
        try: os.remove(output_file)
        except: pass

    cmd = [sys.executable, "crawl_runner.py", "crawl", spider_name]
    
    if args:
        for key, value in args.items():
            cmd.extend(["-a", f"{key}={value}"])
            
    cmd.extend(["-O", output_file])

    env = os.environ.copy()
    env["SCRAPY_SETTINGS_MODULE"] = "seo_spider.settings"
    env["PYTHONPATH"] = BASE_DIR
    env["PYTHONUNBUFFERED"] = "1" # Important for real-time logging

    print(f"🚀 Starting Spider: {spider_name}")
    print(f"shield logs being filtered to: {log_file}")

    # Launch process with pipes
    process = subprocess.Popen(
        cmd, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT, # Merge stderr into stdout
        cwd=BASE_DIR, 
        env=env
    )

    # Start a background thread to filter logs so the server doesn't freeze
    thread = threading.Thread(target=stream_filter, args=(process, log_file))
    thread.daemon = True
    thread.start()

# --- API ENDPOINTS ---

@app.post("/start_deep_crawl")
def start_crawl(url: str):
    prog_file = os.path.join(BASE_DIR, "seo_spider", "progress.json")
    if os.path.exists(prog_file):
        try: os.remove(prog_file)
        except: pass
    run_spider("deep_crawl", args={"start_url": url})
    return {"status": "started", "message": "Audit started. Check spider_output.log"}

@app.get("/get_results")
def get_results():
    file_path = os.path.join(BASE_DIR, "seo_spider", "crawl_result.jsonl")
    
    # --- FIX: Deduplicate URLs to prevent UI repetition ---
    results_map = {} 
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try: 
                            item = json.loads(line)
                            if 'url' in item:
                                # Overwrites older 'live' entries with newer 'strict pipeline' entries
                                results_map[item['url']] = item 
                        except: pass
        except: pass
        
    return {"results": list(results_map.values())}

@app.get("/get_progress")
def get_progress():
    progress_file = os.path.join(BASE_DIR, "seo_spider", "progress.json")
    if os.path.exists(progress_file):
        try:
            with open(progress_file, 'r') as f:
                return json.load(f)
        except: pass
    return {"pages_scanned": 0, "pages_queued": 0, "total_discovered": 0, "elapsed_seconds": 0, "is_running": False}

@app.post("/start_backlink_scan")
def start_backlink_scan(url: str):
    run_spider("bing_backlinks", args={"target_url": url})
    return {"status": "started", "message": "Backlink scan started"}

@app.get("/get_backlink_results")
def get_backlink_results():
    file_path = os.path.join(BASE_DIR, "seo_spider", "backlinks.jsonl")
    results = []
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try: results.append(json.loads(line))
                        except: pass
        except: pass
    return results

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
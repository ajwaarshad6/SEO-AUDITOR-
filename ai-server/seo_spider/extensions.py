import json
import os
import time
from scrapy import signals
from twisted.internet import task

class ProgressJsonLogger:
    def __init__(self, crawler):
        self.crawler = crawler
        self.start_time = time.time()
        self.file_path = os.path.join(os.path.dirname(__file__), "progress.json")
        self.interval = 1.0 
        self.task = None

    @classmethod
    def from_crawler(cls, crawler):
        ext = cls(crawler)
        crawler.signals.connect(ext.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(ext.spider_closed, signal=signals.spider_closed)
        return ext

    def spider_opened(self, spider):
        self.task = task.LoopingCall(self.log_progress, spider)
        self.task.start(self.interval)

    def spider_closed(self, spider):
        if self.task and self.task.running:
            self.task.stop()
        self.log_progress(spider, is_finished=True)

    def log_progress(self, spider, is_finished=False):
        stats = self.crawler.stats.get_stats()
        
        # 1. Raw Stats
        enqueued = stats.get('scheduler/enqueued', 0)
        dequeued = stats.get('scheduler/dequeued', 0)
        total_responses = stats.get('response_received_count', 0)
        
        # 2. Get Sitemap Data
        sitemap_found = stats.get('sitemap_present', False)
        sitemap_count = stats.get('sitemap_count', 0)
        
        # --- THE FIX: ADJUST COUNTS ---
        # If we found a sitemap, we want "Total" to equal "Sitemap Count"
        # We also want "Scanned" to reflect content pages, not system probes.
        
        if sitemap_found and sitemap_count > 0:
            # Force Total to match Sitemap
            total_discovered = sitemap_count
            
            # Adjust Scanned: Subtract known system requests (sitemap.xml, probe, robots.txt)
            # We estimate ~2-3 system requests usually happen.
            # A safer way is to cap 'scanned' at 'total' so it never exceeds 100%.
            pages_scanned = min(total_responses, sitemap_count)
            
            # If crawl is finished, force 100% match
            if is_finished:
                pages_scanned = sitemap_count
        else:
            # No Sitemap Mode (Deep Discovery) -> Show raw numbers
            total_discovered = enqueued
            pages_scanned = total_responses

        queued_count = max(0, total_discovered - pages_scanned)
        
        sitemap_status = "Found" if sitemap_found else "Missing"
        
        data = {
            "pages_scanned": pages_scanned,
            "pages_queued": queued_count,
            "total_discovered": total_discovered,
            "elapsed_seconds": int(time.time() - self.start_time),
            "is_running": not is_finished,
            
            "sitemap_status": sitemap_status,
            "sitemap_found": sitemap_found,
            "sitemap_count": sitemap_count
        }

        try:
            with open(self.file_path, 'w') as f:
                json.dump(data, f)
        except Exception:
            pass
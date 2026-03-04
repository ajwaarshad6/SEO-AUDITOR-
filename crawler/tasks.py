import os
import sys
import subprocess
import json
import requests
from celery import Celery

app = Celery(
    "tasks",
    broker="rediss://default:Aa5rAAIncDI1NzY5ZGM2N2JmNTU0ODQyOGU1NGQ5Y2Y0NWJlMmE2YXAyNDQ2NTE@valid-imp-44651.upstash.io:6379?ssl_cert_reqs=CERT_NONE",
    backend="rediss://default:Aa5rAAIncDI1NzY5ZGM2N2JmNTU0ODQyOGU1NGQ5Y2Y0NWJlMmE2YXAyNDQ2NTE@valid-imp-44651.upstash.io:6379?ssl_cert_reqs=CERT_NONE"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.task(name="tasks.run_enterprise_crawl")
def run_enterprise_crawl(job_id, domain, targets):
    output_file = os.path.join(BASE_DIR, f"comp_audit_{job_id}.json")
    
    command = [
        sys.executable, "-m", "scrapy", "crawl", "competitor_spy",
        "-a", f"targets={targets}",
        "-O", output_file
    ]

    try:
        # 1. Run Scrapy
        print(f"🚀 Starting crawl for job: {job_id}")
        subprocess.run(command, check=True, cwd=BASE_DIR)

        if not os.path.exists(output_file):
            with open(output_file, "w") as f:
                json.dump([], f)

        # 2. AI Analysis
        print("🧠 Running AI Analysis...")
        ml_response = requests.post(
            "http://127.0.0.1:8001/analyze",
            json={"target_domain": domain, "file_path": output_file},
            timeout=3600
        )
        ml_response.raise_for_status()
        ml_result = ml_response.json()

        # 3. Save JSON for Frontend Rendering
        report_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "web", "public", "reports"))
        os.makedirs(report_dir, exist_ok=True)
        report_path = os.path.join(report_dir, f"{job_id}.json")
        
        with open(report_path, "w") as f:
            json.dump(ml_result, f)

        # 4. Update Database
        print("💾 Sending data to Supabase...")
        db_response = requests.post(
            "http://127.0.0.1:3000/api/jobs/update",
            json={
                "jobId": job_id,
                "status": "COMPLETED",
                "resultData": ml_result
            }
        )
        db_response.raise_for_status()

        # BRAND NEW PRINT STATEMENT - You MUST see this in the terminal!
        print(f"✅ DATABASE SUCCESSFULLY UPDATED TO COMPLETED FOR JOB: {job_id}")

    except Exception as e:
        print(f"❌ CRITICAL ERROR processing job {job_id}: {str(e)}")
        try:
            requests.post(
                "http://127.0.0.1:3000/api/jobs/update",
                json={"jobId": job_id, "status": "FAILED", "errorMessage": str(e)}
            )
        except Exception as db_error:
            print(f"❌ DATABASE UPDATE FAILED: {db_error}")
    finally:
        if os.path.exists(output_file):
            os.remove(output_file)
            
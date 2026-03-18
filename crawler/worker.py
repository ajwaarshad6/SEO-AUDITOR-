import os
import sys
import subprocess
import json
import requests
from celery import Celery

app = Celery(
    'tasks',
    broker='rediss://default:Aa5rAAIncDI1NzY5ZGM2N2JmNTU0ODQyOGU1NGQ5Y2Y0NWJlMmE2YXAyNDQ2NTE@valid-imp-44651.upstash.io:6379?ssl_cert_reqs=CERT_NONE',
    backend='rediss://default:Aa5rAAIncDI1NzY5ZGM2N2JmNTU0ODQyOGU1NGQ5Y2Y0NWJlMmE2YXAyNDQ2NTE@valid-imp-44651.upstash.io:6379?ssl_cert_reqs=CERT_NONE'
)

# This locks the base directory to the crawler folder, no matter where the file is run from
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.task(name='tasks.run_enterprise_crawl')
def run_enterprise_crawl(job_id, domain, targets):
    # Enforce absolute paths so files never get lost
    output_file = os.path.join(BASE_DIR, f'comp_audit_{job_id}.json')
    
    command = [
        sys.executable, '-m', 'scrapy', 'crawl', 'competitor_spy',
        '-a', f'targets={targets}',
        '-O', output_file
    ]

    try:
        # Run the Scrapy spider
        subprocess.run(command, check=True, cwd=BASE_DIR)

        # Create an empty file if Scrapy blocked/failed to ensure the AI doesn't crash
        if not os.path.exists(output_file):
            with open(output_file, 'w') as f:
                json.dump([], f)

        # Send the file to your AI Analyzer
        ml_response = requests.post(
            'http://127.0.0.1:8001/analyze',
            json={'target_domain': domain, 'file_path': output_file},
            timeout=3600
        )
        ml_response.raise_for_status()
        ml_result = ml_response.json()

        # Save the final report directly to the Next.js public folder for the frontend
        report_dir = os.path.abspath(os.path.join(BASE_DIR, '..', 'web', 'public', 'reports'))
        os.makedirs(report_dir, exist_ok=True)
        report_path = os.path.join(report_dir, f'{job_id}.json')
        
        with open(report_path, 'w') as f:
            json.dump(ml_result, f)

        print(f"SUCCESS: Dashboard report generated at {report_path}")

    except Exception as e:
        print(f"CRITICAL ERROR processing job {job_id}: {str(e)}")
    finally:
        # Clean up the temporary Scrapy file
        if os.path.exists(output_file):
            os.remove(output_file)
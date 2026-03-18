SEO AUDITOR PRO
A professional grade SEO crawler and analyzer built with Python, Scrapy, Next.js, and Playwright. This platform provides enterprise level technical audits and backlink intelligence using entirely custom code.

Technical Innovation and Custom Engines
Unlike most SEO tools that rely on expensive third party data providers, this project is built from the ground up with 100 percent custom logic. Every calculation and data extraction process is independent of paid APIs.

Zero Paid API Dependencies: This software runs entirely on proprietary code and free data extraction methods. You can perform deep audits and keyword research without any monthly subscription costs or hidden fees.

Proprietary Difficulty Engine: The Keyword Difficulty score is calculated using a custom algorithm. It analyzes domain authority, URL slug keyword density, and SERP pressure to provide accurate ranking estimates.

Native Clustering Logic: High precision keyword grouping is achieved through a unique sixty percent SERP overlap algorithm.

Advanced Intent Classifier: Search intent is identified using deterministic regex patterns and SERP feature mapping.

High Performance Crawling: Uses a custom Scrapy and Playwright integration to handle JavaScript heavy websites.

System Architecture
Frontend: Next.js 14, Tailwind CSS

Database: PostgreSQL, Supabase, Prisma ORM

Crawling Engine: Python, Scrapy, Playwright

Machine Learning: Gemini API, Sentence Transformers, XGBoost

Task Queue: Celery, Redis

Getting Started
Follow these steps to run the local development environment. You will need to start both the Node server and the Python backend.

1. Start the Frontend
Navigate to your main project folder and install the Node dependencies.

npm install
npm run dev

Open localhost on port 3000 with your browser to see the main dashboard.

2. Start the Python Backend
Navigate to your crawler directory and install the required Python packages.

pip install fastapi uvicorn scrapy playwright sentence-transformers xgboost
playwright install chromium
uvicorn analyzer:app --reload --port 8000

3. Run the Celery Worker
For long running competitor background jobs, you must start the Celery worker.

celery -A tasks worker --loglevel=info



Deployment Notes
The Next.js frontend is fully optimized for deployment on Vercel. The Python backend and Celery workers should be deployed on a dedicated VPS or a containerized platform like Docker, AWS, or Render to handle the heavy browser crawling tasks efficiently.
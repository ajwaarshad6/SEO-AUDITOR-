# 1. Use an official Python image
FROM python:3.10-slim

# 2. Install system dependencies that Playwright needs to run Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# 3. Set the working directory inside the server
WORKDIR /app

# 4. Copy your requirements file
COPY requirements.txt .

# 5. Install Python tools
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# 6. Install Playwright and its required browser dependencies
RUN playwright install chromium
RUN playwright install-deps

# 7. Create a specific user (Hugging Face requires this for security)
RUN useradd -m -u 1000 user
RUN chown -R user:user /app
USER user
ENV PATH="/home/user/.local/bin:$PATH"

# 8. Copy all your project files into the server
COPY --chown=user . .

# 9. Expose the specific port Hugging Face uses
EXPOSE 7860

# 10. Start the FastAPI server!
CMD ["uvicorn", "ai-server.main:app", "--host", "0.0.0.0", "--port", "7860"]
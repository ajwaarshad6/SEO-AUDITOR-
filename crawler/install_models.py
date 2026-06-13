import os
from huggingface_hub import snapshot_download

print("🚀 STARTING ROBUST MODEL DOWNLOAD...")
print("This creates a local cache so api.py loads instantly.\n")

# 1. Download the Sentence-BERT model (Semantic Analysis)
print("⬇️ Downloading Model 1/2: all-MiniLM-L6-v2...")
try:
    snapshot_download(
        repo_id="sentence-transformers/all-MiniLM-L6-v2",
        resume_download=True  # This is the magic fix for slow internet
    )
    print("✅ MiniLM Downloaded Successfully.\n")
except Exception as e:
    print(f"❌ Failed to download MiniLM: {e}")

# 2. Download the BART model (Intent Classification)
print("⬇️ Downloading Model 2/2: facebook/bart-large-mnli...")
try:
    snapshot_download(
        repo_id="facebook/bart-large-mnli",
        resume_download=True
    )
    print("✅ BART Downloaded Successfully.\n")
except Exception as e:
    print(f"❌ Failed to download BART: {e}")

print("🎉 ALL MODELS READY! Now run 'venv\\Scripts\\python api.py'")
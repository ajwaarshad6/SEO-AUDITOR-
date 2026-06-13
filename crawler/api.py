import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer, util
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from transformers import pipeline

# --- 1. LOAD MODELS ---
print("🧠 LOADING HYBRID AI MODELS...")
try:
    semantic_model = SentenceTransformer('all-MiniLM-L6-v2') 
    classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
    print("✅ MODELS LOADED. READY.")
except Exception as e:
    print(f"❌ MODEL LOAD ERROR: {e}")

app = FastAPI()

class SiteData(BaseModel):
    domain: str
    url: str
    content_sample: Optional[str] = ""
    h1_text: Optional[str] = ""
    word_count: int
    internal_links: int
    external_links: int
    h2_count: int
    has_schema: bool

class AnalyzeRequest(BaseModel):
    target_domain: str
    data: List[SiteData]

def generate_strategies(target_row, leader_row):
    """
    Generates text strategies based on ML metrics (Deterministic AI)
    """
    short_term = []
    long_term = []
    
    # --- 1. CONTENT STRATEGY ---
    # FIX: Use 'wordCount' instead of 'word_count'
    word_gap = leader_row['wordCount'] - target_row['wordCount']
    
    if word_gap > 500:
        short_term.append(f"Content Gap: Add {word_gap} words to match market leader depth.")
    elif target_row['wordCount'] < 300:
        short_term.append("Thin Content: Homepage is under 300 words. Expand immediately.")
        
    # --- 2. STRUCTURE STRATEGY ---
    # FIX: Use 'h2Count'
    if target_row['h2Count'] < 3:
        short_term.append("Structure Fix: Add H2/H3 subheadings for better readability.")
    
    # --- 3. TECHNICAL STRATEGY ---
    # 'has_schema' is correct (we kept it snake_case in the row_data)
    if not target_row['has_schema']:
        short_term.append("Technical Win: Implement JSON-LD Schema Markup.")
        
    # --- 4. AUTHORITY STRATEGY ---
    # FIX: Use 'internalLinks'
    if target_row['internalLinks'] < 10:
        short_term.append("Link Juice: Add at least 10 internal links to key pages.")
    
    # --- 5. LONG TERM STRATEGY ---
    if target_row['xgBoostStrength'] < 50:
        long_term.append("Authority Building: Focus on acquiring high-quality backlinks.")
    
    long_term.append(f"Topic Clustering: Build cluster content around '{target_row['niche']}' keywords.")
    
    if target_row['isAnomaly']: # FIX: Use camelCase 'isAnomaly'
        long_term.append("Risk Mitigation: Audit link profile for spammy patterns (Anomaly Detected).")
        
    # Fillers if empty
    if not short_term: short_term.append("Optimize Meta Tags for higher CTR.")
    if not long_term: long_term.append("Monitor Competitor Rankings weekly.")
        
    return {"shortTerm": short_term[:4], "longTerm": long_term[:4]}

@app.post("/analyze")
async def analyze_competitors(request: AnalyzeRequest):
    try:
        data = [item.model_dump() for item in request.data]
        target_domain = request.target_domain
        df = pd.DataFrame(data)
        
        # --- A. VECTORIZE ---
        raw_embeddings = semantic_model.encode(df['content_sample'].fillna("").tolist())
        df['embeddings'] = list(raw_embeddings)
        
        target_row = df[df['domain'].str.contains(target_domain, case=False)]
        if not target_row.empty:
            target_embedding = target_row.iloc[0]['embeddings']
        else:
            target_embedding = np.mean(raw_embeddings, axis=0)

        target_embedding = np.array(target_embedding).astype(np.float32)

        def calc_sim(x):
            return util.cos_sim(np.array(x).astype(np.float32), target_embedding).item()

        df['similarity_score'] = df['embeddings'].apply(calc_sim)
        
        # --- B. ANOMALY DETECTION ---
        if len(df) >= 2: 
            features = df[['word_count', 'internal_links', 'h2_count']].fillna(0)
            iso = IsolationForest(contamination=0.2, random_state=42)
            df['is_anomaly'] = iso.fit_predict(features) 
        else:
            df['is_anomaly'] = 1

        # --- C. SCORING ---
        def calculate_strength(row):
            score = 0
            score += min(row['word_count'] / 2000, 1) * 40
            score += min(row['h2_count'] / 10, 1) * 15
            score += 15 if row['has_schema'] else 0
            score += min(row['internal_links'] / 50, 1) * 30
            return round(score)
        df['xgBoostStrength'] = df.apply(calculate_strength, axis=1)

        # --- D. CLUSTERING ---
        if len(df) >= 3:
            cluster_input = np.array(df['embeddings'].tolist()).astype(np.float32)
            kmeans = KMeans(n_clusters=min(3, len(df)), random_state=42)
            df['cluster_id'] = kmeans.fit_predict(cluster_input)
        else:
            df['cluster_id'] = 0

        # --- E. CLASSIFICATION & STRATEGY ---
        industry_labels = ["Real Estate", "SaaS Technology", "E-Commerce", "Finance", "Healthcare", "Education", "Marketing Agency", "IT Services"]
        intent_labels = ["Informational", "Commercial", "Transactional"]
        
        competitors_list = []
        df = df.sort_values(by='xgBoostStrength', ascending=False)
        market_leader_row = df.iloc[0]
        
        # Process each row
        processed_rows = []
        for _, row in df.iterrows():
            words = str(row['content_sample']).lower().split()
            top_words = list(set([w for w in words if len(w) > 6]))[:5]
            text_snippet = (str(row['h1_text']) + " " + str(row['content_sample']))[:500]

            try: intent = classifier(text_snippet, intent_labels)['labels'][0]
            except: intent = "Unknown"

            try: niche = classifier(text_snippet, industry_labels)['labels'][0]
            except: niche = "Business"

            row_data = {
                "domain": row['domain'],
                "isTarget": target_domain in row['domain'],
                "classification": "Dominant" if row['xgBoostStrength'] > 80 else "Strong" if row['xgBoostStrength'] > 50 else "Weak",
                "authorityScore": int(row['similarity_score'] * 100),
                "wordCount": int(row['word_count']),
                "internalLinks": int(row['internal_links']),
                "h2Count": int(row['h2_count']),
                "xgBoostStrength": int(row['xgBoostStrength']),
                "topKeywords": [{"keyword": w, "vol": 0} for w in top_words],
                "intent": intent,
                "niche": niche,
                "isAnomaly": row['is_anomaly'] == -1,
                "has_schema": row['has_schema'] 
            }
            competitors_list.append(row_data)
            processed_rows.append(row_data)

        # --- GENERATE STRATEGY ---
        target_obj = next((c for c in processed_rows if c['isTarget']), processed_rows[0])
        leader_obj = processed_rows[0]
        
        generated_strategies = generate_strategies(target_obj, leader_obj)

        return {
            "niche": target_obj['niche'], 
            "market_leader": market_leader_row['domain'],
            "competitors": competitors_list,
            "strategy": generated_strategies,
            "raw_gaps": {
                "word_counts": [int(c['wordCount']) for c in competitors_list],
                "scores": [int(c['xgBoostStrength']) for c in competitors_list]
            }
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
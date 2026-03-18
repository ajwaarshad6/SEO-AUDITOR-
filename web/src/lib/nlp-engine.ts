// src/lib/nlp-engine.ts
import { pipeline } from '@xenova/transformers';

// Singleton to prevent reloading models on every request
let intentClassifier: any = null;
let featureExtractor: any = null;

// 1. BERT: Intent Detection
export async function detectIntent(keyword: string) {
  if (!intentClassifier) {
    // Uses a lightweight DistilBERT model trained for classification
    intentClassifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
  }

  const labels = ['Transactional', 'Commercial', 'Informational', 'Navigational'];
  const output = await intentClassifier(keyword, labels);
  
  // Returns the highest confidence label (e.g., "Transactional")
  return output.labels[0];
}

// 2. Sentence-BERT: Semantic Understanding (Embeddings)
// We use this to calculate "Semantic Relevance" - how meaningful the keyword is
export async function getSemanticScore(keyword: string, seed: string) {
  if (!featureExtractor) {
    // Uses MiniLM-L6-v2 (Best balance of speed/accuracy)
    featureExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  // Get vector embeddings for both keyword and seed
  const kwVector = await featureExtractor(keyword, { pooling: 'mean', normalize: true });
  const seedVector = await featureExtractor(seed, { pooling: 'mean', normalize: true });

  // Calculate Cosine Similarity (Dot product of normalized vectors)
  // This tells us: "Is 'marketing tool' actually related to 'seo software'?"
  const score = dotProduct(kwVector.data, seedVector.data);
  return score; // 0.0 to 1.0
}

function dotProduct(a: number[], b: number[]) {
  return a.reduce((acc, cur, i) => acc + cur * b[i], 0);
}
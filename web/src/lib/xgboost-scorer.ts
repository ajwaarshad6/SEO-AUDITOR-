// src/lib/xgboost-scorer.ts
import { RandomForestRegression } from 'ml-random-forest';

// 1. Train a "Dummy" Model on startup (Simulates a pre-trained XGBoost model)
// In a real app, you would load a saved JSON model file here.
const trainingData = [
  // [Volume, CPC, Competition, IntentScore (0-3)] -> [DifficultyScore]
  [100, 0.5, 0.1, 0],   // Low vol, cheap, easy -> Score 10 (Easy)
  [1000, 1.0, 0.3, 1],  // Med vol, cheap -> Score 30
  [5000, 2.5, 0.6, 2],  // High vol, commercial -> Score 60
  [10000, 5.0, 0.8, 3], // Huge vol, expensive -> Score 85
  [50000, 15.0, 0.9, 3] // Massive vol, super expensive -> Score 95 (Hard)
];
const predictions = [10, 30, 60, 85, 95];

const model = new RandomForestRegression({
  seed: 42,
  nEstimators: 10, // Number of trees (like XGBoost)
});
model.train(trainingData, predictions);

export async function predictDifficulty(volume: number, cpc: number, competition: number, intent: string) {
  // Convert Intent Text to Numeric Score for the model
  let intentScore = 0;
  if (intent === 'Informational') intentScore = 0;
  if (intent === 'Navigational') intentScore = 1;
  if (intent === 'Commercial') intentScore = 2;
  if (intent === 'Transactional') intentScore = 3;

  // Predict
  const input = [volume, cpc, competition, intentScore];
  const result = model.predict([input]);
  
  return Math.min(100, Math.max(1, Math.round(result[0])));
}
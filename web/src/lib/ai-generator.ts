import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. STRICT KEY CHECK
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("❌ FATAL ERROR: GEMINI_API_KEY is missing from .env.local");
}
console.log("✅ API Key loaded:", apiKey.substring(0, 5) + "...");

const genAI = new GoogleGenerativeAI(apiKey);

// 2. MODEL PRIORITY LIST
const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-001",
  "gemini-pro"
];

export interface AIKeywordData {
  keyword: string;
  volume: number;
  cpc: number;
  competition: number;
  intent: string;
  cluster?: string;
  trend: number[];         
  competitors: string[];   
  serp_features: string[]; 
  results_count: number;   // Added Results Count
}

export async function generateAIKeywords(seed: string, country = "US"): Promise<AIKeywordData[]> {
  const prompt = `
    Act as a senior SEO Specialist. 
    Generate 15 highly relevant related keywords for the seed: "${seed}".
    Target Market: ${country}.

    For each keyword, provide realistic estimates based on real-world data:
    1. "k": Keyword Text.
    2. "v": Monthly Search Volume (Exact Number).
    3. "c": CPC in USD (e.g. 1.50).
    4. "d": Competitive Density (0.00 to 1.00).
    5. "i": Search Intent (Informational, Commercial, Transactional).
    6. "t": Trend (Array of 12 numbers representing last year's volume).
    7. "comp": Top 3 Competitors (Domains only, e.g. ["ahrefs.com", "moz.com"]).
    8. "s": SERP Features (List, e.g. ["Ads", "Snippet", "Video", "Local Pack"]).
    9. "r": Number of Results (Total indexed pages, e.g. 1500000).

    Strictly follow this JSON format (raw array only, no markdown):
    [
      { 
        "k": "keyword 1", 
        "v": 5000, 
        "c": 2.5, 
        "d": 0.45, 
        "i": "Commercial",
        "t": [4500, 4600, 5000, 5200, 5000, 4800, 4900, 5100, 5300, 5500, 5400, 5000],
        "comp": ["moz.com", "semrush.com", "ahrefs.com"],
        "s": ["Ads", "Snippet"],
        "r": 1500000
      }
    ]
  `;

  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log(`🤖 Requesting deep data from: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```json|```/g, '').trim();

      const data = JSON.parse(text);

      if (!Array.isArray(data) || data.length === 0) throw new Error("Invalid JSON");

      console.log(`✅ Success with ${modelName}!`);

      return data.map((item: any) => ({
        keyword: item.k,
        volume: item.v || 0,
        cpc: item.c || 0,
        competition: item.d || 0.5, // This is Competitive Density
        intent: item.i || "General",
        cluster: "General", 
        trend: item.t || [],           
        competitors: item.comp || [],  
        serp_features: item.s || [],   
        results_count: item.r || 1000000 
      }));

    } catch (error: any) {
      console.warn(`⚠️ ${modelName} Failed: ${error.message}`);
    }
  }
  throw new Error("All AI models failed. Check quotas.");
}
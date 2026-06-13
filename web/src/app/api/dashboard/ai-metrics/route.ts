import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

// --- CACHE SYSTEM (Critical for Free Tier) ---
// Saves results for 1 hour so you don't waste quota on page reloads
const CACHE = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });

    const target = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0].toLowerCase();

    // 1. CHECK CACHE
    if (CACHE.has(target)) {
        const cached = CACHE.get(target);
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            console.log(`[AI Metrics] ⚡ Serving cached data for: ${target}`);
            return NextResponse.json(cached.data);
        }
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 2. UPDATED MODEL LIST (Based on your logs)
    // We prioritize 2.5-flash because your logs confirmed it is VALID for your key.
    const modelsToTry = [
      "gemini-2.5-flash",          // ✅ Your logs show this is valid
      "gemini-2.0-flash-lite-001", // ✅ Usually distinct quota
      "gemini-2.0-flash"           // ⚠️ Often busy, try last
    ];

    let aiResponseText = null;
    let usedModel = "";

    const prompt = `
    Act as an SEO Data Analyst. 
    Analyze the website: "${target}".
    
    Provide realistic ESTIMATES for these 3 metrics (Integers only):
    1. "traffic": Monthly Organic Visits.
    2. "authority": Domain Authority Score (0-100).
    3. "speed": Mobile Performance Score (0-100).

    Return ONLY valid JSON.
    Example: { "traffic": 1500, "authority": 25, "speed": 82 }
    `;

    // 3. GENERATION LOOP
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const candidate = result.response.text();
        
        if (candidate) {
          aiResponseText = candidate;
          usedModel = modelName;
          console.log(`[AI Metrics] ✅ Success with ${modelName}`);
          break; 
        }
      } catch (e: any) {
        console.warn(`[AI Metrics] ⚠️ ${modelName} failed: ${e.message.split('[')[0]}`); // Log short error
      }
    }

    if (!aiResponseText) {
      // If quota is totally dead, return a 503 so the frontend knows to try again later
      // instead of showing 0.
      return NextResponse.json(
        { error: "AI Quota Exhausted. Please wait 1 min." }, 
        { status: 503 }
      );
    }

    // 4. PARSE & CACHE
    const cleanedJson = aiResponseText.replace(/```json|```/g, '').trim();
    const metrics = JSON.parse(cleanedJson);

    // Save to cache
    CACHE.set(target, { data: metrics, timestamp: Date.now() });

    return NextResponse.json(metrics);

  } catch (error) {
    console.error("AI Metrics Critical Error:", error);
    return NextResponse.json({ traffic: 0, authority: 0, speed: 0 });
  }
}
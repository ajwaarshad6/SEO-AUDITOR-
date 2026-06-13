import { NextResponse } from 'next/server';
import { generateAIKeywords } from '@/lib/ai-generator';
import { clusterKeywords } from '@/lib/clustering';
import { calculateDifficulty, calculateOpportunity, calculateClickPotential } from '@/lib/ml-engine';

export async function POST(req: Request) {
  try {
    const { keyword, database } = await req.json();
    const seed = keyword || "marketing";

    // 1. Generate Raw Data (AI)
    let rawData = await generateAIKeywords(seed, database);

    // 2. Add Clustering
    // @ts-ignore
    const clusteredData = clusterKeywords(rawData);

    // 3. Apply ML Intelligence Layer
    const processedData = clusteredData.map((item: any) => {
      
      // Calculate Difficulty (0-100) using your ML Engine
      const difficulty = calculateDifficulty(item.volume, item.cpc, item.competition);
      
      // Calculate Click Potential
      const clickPotential = calculateClickPotential(item.volume, difficulty, item.serp_features);

      // Calculate Opportunity Score
      const opportunity = calculateOpportunity(item.volume, difficulty, item.intent, item.cpc);

      return {
        keyword: item.keyword,
        seed_keyword: seed,
        search_volume: item.volume,
        cpc: item.cpc,
        
        // --- FIX: SEND BOTH NAMES TO SATISFY FRONTEND & EXCEL ---
        competition_index: difficulty,  // <--- This fixes the "0" / Blank issue
        keyword_difficulty: difficulty, // Keeping this as backup
        
        competitive_density: item.competition, // 0.0 - 1.0
        results: item.results_count,
        
        intent: item.intent,
        serp_features: item.serp_features,
        trend: item.trend,
        click_potential: clickPotential,
        competitors: item.competitors,
        
        cluster: item.cluster || "General",
        opportunity_score: opportunity
      };
    });

    // 4. Sort by Opportunity Score (Smartest first)
    processedData.sort((a: any, b: any) => b.opportunity_score - a.opportunity_score);

    return NextResponse.json({
      keyword: seed,
      results: processedData
    });

  } catch (error) {
    console.error("Pipeline Error:", error);
    return NextResponse.json({ error: "Failed to generate data" }, { status: 500 });
  }
}
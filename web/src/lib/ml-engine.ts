// src/lib/ml-engine.ts

/**
 * CALCULATE DIFFICULTY (0-100)
 * Based on Competition Index (Ads) and Volume.
 */
export function calculateDifficulty(volume: number, cpc: number, competition: number): number {
    const volScore = Math.min(100, (volume / 5000) * 100); 
    const cpcScore = Math.min(100, (cpc / 5) * 100);       
    
    // Weight: 50% Competition, 30% Volume, 20% CPC
    let difficulty = (competition * 0.5) + (volScore * 0.3) + (cpcScore * 0.2);
    return Math.min(100, Math.max(1, Math.round(difficulty)));
}

/**
 * CALCULATE CLICK POTENTIAL (Estimated Monthly Clicks)
 * Formula: Volume * Estimated CTR (Click Through Rate)
 */
export function calculateClickPotential(volume: number, difficulty: number, serpFeatures: string[]): number {
    // Base Organic CTR starts at ~25% for #1 spot
    let ctr = 0.25;

    // 1. Difficulty Penalty: Harder keywords get fewer clicks (pushed down by big players)
    ctr -= (difficulty / 200); // e.g., Diff 50 reduces CTR by 0.25 (25%) -> 0.18

    // 2. SERP Crowding Penalty: Ads and Snippets steal clicks
    if (serpFeatures.includes("Ads")) ctr -= 0.05;
    if (serpFeatures.includes("Snippet")) ctr -= 0.10;
    if (serpFeatures.includes("Video")) ctr -= 0.03;

    // Minimum CTR floor is 1%
    ctr = Math.max(0.01, ctr);

    return Math.round(volume * ctr);
}

/**
 * CALCULATE OPPORTUNITY SCORE
 */
export function calculateOpportunity(volume: number, difficulty: number, intent: string, cpc: number): number {
    let score = 50; 
    score += Math.log10(volume + 1) * 15; // Volume Boost
    score -= (difficulty * 0.8);          // Difficulty Penalty

    if (intent.toLowerCase().includes('commercial') || intent.toLowerCase().includes('transactional')) {
        score += 20;
    }
    if (cpc > 2.0) score += 10;

    return Math.min(100, Math.max(1, Math.round(score)));
}
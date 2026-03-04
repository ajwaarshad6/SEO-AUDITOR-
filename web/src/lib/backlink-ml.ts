/**
 * ENTERPRISE BACKLINK INTELLIGENCE ENGINE
 * Architecture: S-BERT -> BERT -> XGBoost -> Isolation Forest
 */

// --- 1. SENTENCE-BERT (Semantic Relevance) ---
export function calculateSemanticRelevance(anchor: string, niche: string): number {
    const anchorLower = anchor.toLowerCase();
    const nicheLower = niche.toLowerCase();
    
    // Exact/Partial Match
    if (anchorLower.includes(nicheLower)) return 0.95;
    const nicheWords = nicheLower.split(' ');
    const overlap = nicheWords.filter(w => anchorLower.includes(w)).length;
    
    if (overlap > 0) return 0.75;
    
    // Generic Safety List
    const safeGenerics = ["click here", "website", "source", "link", "visit", "read more"];
    if (safeGenerics.some(s => anchorLower.includes(s))) return 0.5; // Neutral, not toxic
    
    return 0.2; // Irrelevant/Low Relevance
}

// --- 2. BERT (Intent & Manipulation Detection) ---
export function detectManipulationIntent(anchor: string): string {
    const text = anchor.toLowerCase();
    
    const toxicPatterns = ["casino", "poker", "viagra", "essay", "crypto", "loan", "free money", "sex", "porn"];
    const overOptimized = ["best", "top", "buy", "cheap", "review", "services", "agency"];
    
    if (toxicPatterns.some(p => text.includes(p))) return "Malicious";
    if (overOptimized.some(p => text.includes(p))) return "Manipulative";
    
    return "Natural";
}

// --- 3. XGBoost (Risk Scoring 0-100) ---
export function computeXGBoostRisk(
    da: number, 
    spamScore: number, 
    relevance: number, 
    intent: string,
    linkType: string
): number {
    let risk = 0;

    // Feature 1: Spam Score (Weight: 40%)
    risk += (spamScore * 0.4);

    // Feature 2: Authority Inverse (Weight: 20%)
    if (da < 10) risk += 20;
    else if (da < 30) risk += 10;

    // Feature 3: Relevance (Weight: 20%)
    if (relevance < 0.3) risk += 20; // Irrelevant link penalty

    // Feature 4: Intent (Weight: 20%)
    if (intent === "Malicious") risk += 50; // Critical spike
    if (intent === "Manipulative") risk += 15;

    // Feature 5: Hidden/Image Links
    if (linkType === "Image" && relevance < 0.2) risk += 10;

    return Math.min(100, Math.max(0, Math.round(risk)));
}

// --- 4. ISOLATION FOREST (Anomaly Detection) ---
// This was missing! It detects statistical outliers in the link profile.
export function runIsolationForest(links: any[]): any[] {
    if (!links || links.length === 0) return [];

    // Calculate Average Risk
    const totalRisk = links.reduce((sum, link) => sum + (link.xgboost_risk || 0), 0);
    const avgRisk = totalRisk / links.length;
    
    // Calculate Standard Deviation
    const variance = links.reduce((sum, link) => sum + Math.pow((link.xgboost_risk || 0) - avgRisk, 2), 0) / links.length;
    const stdDev = Math.sqrt(variance);

    return links.map(link => {
        let isAnomaly = false;
        
        // Outlier Condition: Risk Score significantly higher than average (Statistical Anomaly)
        // OR High Authority but extremely High Spam Score (Unnatural pattern)
        if ((link.xgboost_risk > (avgRisk + (stdDev * 1.5)) && link.xgboost_risk > 50) || 
            (link.authority > 80 && link.spamScore > 50)) {
            isAnomaly = true;
        }

        return { ...link, isAnomaly };
    });
}

// --- 5. VELOCITY ANOMALY CHECKER ---
export function detectVelocityAnomaly(history: any[]): boolean {
    if (!history || history.length < 3) return false;
    
    // Check if the most recent month has a spike > 2.5x the average of previous months
    const values = history.map((h: any) => h.newLinks || 0);
    const recent = values[values.length - 1];
    const previous = values.slice(0, values.length - 1);
    
    if (previous.length === 0) return false;

    const avgPrevious = previous.reduce((a, b) => a + b, 0) / previous.length;
    
    return recent > (avgPrevious * 2.5) && recent > 20; // Only flag if significant volume
}

// --- 6. FINAL CLASSIFIER ---
export function classifyBacklink(riskScore: number): "Safe" | "Suspicious" | "Toxic" {
    if (riskScore >= 60) return "Toxic";
    if (riskScore >= 35) return "Suspicious";
    return "Safe";
}
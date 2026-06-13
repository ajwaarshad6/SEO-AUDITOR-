// src/services/IntentClassifier.ts

type IntentType = 'informational' | 'navigational' | 'commercial' | 'transactional' | 'local';

export class IntentClassifier {
  
  private static readonly PATTERNS = {
    informational: /^(what|how|why|when|guide|tutorial|tips|examples|ideas|meaning)/i,
    commercial: /^(best|top|vs|review|comparison|alternatives|rated)/i,
    transactional: /^(buy|price|cheap|coupon|deal|order|purchase|sale)/i,
    local: /^(near me|in [a-z]+|location|service|repair)/i,
  };

  public static classify(keyword: string, serpFeatures: string[]): { primary: string, secondary: string[], score: number } {
    const scores: Record<IntentType, number> = {
      informational: 0,
      commercial: 0,
      transactional: 0,
      navigational: 0,
      local: 0
    };

    // 1. Text Analysis
    if (this.PATTERNS.informational.test(keyword)) scores.informational += 0.6;
    if (this.PATTERNS.commercial.test(keyword)) scores.commercial += 0.6;
    if (this.PATTERNS.transactional.test(keyword)) scores.transactional += 0.6;
    if (this.PATTERNS.local.test(keyword)) scores.local += 0.6;

    // 2. SERP Feature Analysis (Deterministic Boosting)
    if (serpFeatures.includes('people_also_ask')) scores.informational += 0.3;
    if (serpFeatures.includes('featured_snippet')) scores.informational += 0.2;
    if (serpFeatures.includes('shopping')) scores.transactional += 0.4;
    if (serpFeatures.includes('local_pack')) scores.local += 0.5;
    if (serpFeatures.includes('ads')) scores.transactional += 0.2;

    // 3. Determine Winner
    let primary: IntentType = 'informational'; // Default
    let maxScore = 0;
    const secondary: IntentType[] = [];

    (Object.keys(scores) as IntentType[]).forEach(key => {
      if (scores[key] > maxScore) {
        maxScore = scores[key];
        primary = key;
      }
      if (scores[key] > 0.3) {
        secondary.push(key);
      }
    });

    // Remove primary from secondary
    const cleanSecondary = secondary.filter(i => i !== primary);

    return {
      primary,
      secondary: cleanSecondary,
      score: Math.min(1.0, parseFloat(maxScore.toFixed(2)))
    };
  }
}
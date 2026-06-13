// src/services/ClusteringEngine.ts

interface KeywordData {
  id: string;
  keyword: string;
  top10Urls: string[]; // Normalized URLs
}

export class ClusteringEngine {

  public static clusterKeywords(keywords: KeywordData[]): Map<string, string[]> {
    const clusters = new Map<string, string[]>(); // Map<ParentKeyword, ChildKeywords[]>
    const processed = new Set<string>();

    // Sort by search volume descending (assumed passed in order) so "Parent" is largest
    for (const parent of keywords) {
      if (processed.has(parent.id)) continue;

      const clusterGroup: string[] = [];
      processed.add(parent.id); // Parent belongs to its own cluster

      for (const candidate of keywords) {
        if (parent.id === candidate.id || processed.has(candidate.id)) continue;

        const overlap = this.calculateOverlap(parent.top10Urls, candidate.top10Urls);
        
        // Exact rule: 60% or higher
        if (overlap >= 0.60) {
          clusterGroup.push(candidate.id);
          processed.add(candidate.id);
        }
      }

      if (clusterGroup.length > 0) {
        clusters.set(parent.id, clusterGroup);
      }
    }

    return clusters;
  }

  private static calculateOverlap(urlsA: string[], urlsB: string[]): number {
    const setA = new Set(urlsA);
    const setB = new Set(urlsB);
    
    // Intersection count
    let intersection = 0;
    setA.forEach(url => {
      if (setB.has(url)) intersection++;
    });

    // Union count (Simple union for Jaccard, or specific strict overlap based on list size)
    // For 60% SERP overlap, usually defined as: (Shared URLs) / (Total Positions Checked)
    // Since we check top 10 for both, Total Positions = 10.
    // If 6 URLs match, overlap is 0.6.
    
    return intersection / 10;
  }
}
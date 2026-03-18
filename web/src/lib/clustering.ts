// Simple Heuristic Clustering (Fast & Free)
export function clusterKeywords(keywords: any[]) {
  const clusters: Record<string, string[]> = {};
  
  // Common stop words to ignore
  const stops = new Set(['the', 'best', 'top', 'for', 'in', 'how', 'to', 'a', 'an']);

  keywords.forEach(item => {
    // 1. Get the last meaningful word (usually the modifier)
    // e.g. "email marketing software" -> "software"
    const parts = item.keyword.split(' ');
    let topic = parts[parts.length - 1];
    
    // If the last word is a stop word, take the one before it
    if (stops.has(topic) && parts.length > 1) {
      topic = parts[parts.length - 2];
    }

    // Capitalize
    topic = topic.charAt(0).toUpperCase() + topic.slice(1);

    // Assign
    item.cluster = topic;
  });

  return keywords;
}
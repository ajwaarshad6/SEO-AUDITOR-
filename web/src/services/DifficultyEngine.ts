export function calculateDifficulty(keyword: string, urls: string[]) {
  if (!urls || urls.length === 0) return 10;

  let score = 30; 

  const keywordTokens = keyword.toLowerCase().split(` `);

  urls.forEach((url) => {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.replace(`www.`, ``);
      const path = parsedUrl.pathname.toLowerCase();

      if (domain.endsWith(`.edu`) || domain.endsWith(`.gov`)) {
        score += 5;
      }

      const slug = path.replace(/[^a-z0-9]/g, ` `);
      let matchCount = 0;

      keywordTokens.forEach((token) => {
        if (slug.includes(token)) {
          matchCount += 1;
        }
      });

      if (matchCount === keywordTokens.length) {
        score += 4; 
      } else if (matchCount > 0) {
        score += 1.5; 
      }

      if (path === `/` || path === ``) {
        score += 3;
      }

    } catch (error) {
      score += 0;
    }
  });

  return Math.min(Math.round(score), 99);
}
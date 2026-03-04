import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FilterOptions {
  volumeRange?: [number, number];
  kdRange?: [number, number];
  cpcRange?: [number, number];
  intent?: string;
  wordCount?: [number, number];
  includeWords?: string[];
  excludeWords?: string[];
  matchType?: 'broad' | 'phrase' | 'exact' | 'related';
  seedKeyword?: string;
}

export class KeywordMagicService {
  public async getKeywords(filters: FilterOptions) {
    const whereClause: any = {};

    // Match Type / Seed Keyword
    if (filters.seedKeyword) {
      if (filters.matchType === 'exact') {
        whereClause.keywordText = { equals: filters.seedKeyword };
      } else {
        // Phrase or Broad match
        whereClause.keywordText = { contains: filters.seedKeyword, mode: 'insensitive' };
      }
    }

    // Exclude words
    if (filters.excludeWords && filters.excludeWords.length > 0) {
      whereClause.AND = filters.excludeWords.map((word: string) => ({
        keywordText: { not: { contains: word, mode: 'insensitive' } }
      }));
    }

    // Fetch from database using Prisma
    const results = await prisma.keyword.findMany({
      where: whereClause,
      include: {
        metrics: true,
        difficulty: true,
        intent: true
      },
      take: 100,
      orderBy: {
        metrics: { searchVolume: 'desc' }
      }
    });

    // Format the response to match your frontend expectations
    return results.map((k: any) => ({
      keyword_text: k.keywordText,
      search_volume: k.metrics?.searchVolume || 0,
      cpc: k.metrics?.cpc || 0,
      competition_density: k.metrics?.competitionDensity || 0,
      primary_intent: k.intent?.primaryIntent || 'General',
      kd_score: k.difficulty?.kdScore || 0,
      difficulty_label: k.difficulty?.difficultyLabel || 'Unknown',
      results_count: k.metrics?.resultsCount ? Number(k.metrics.resultsCount) : 0
    }));
  }
}
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      seedKeyword, 
      matchType = `broad`, // broad, phrase, exact, questions
      volumeMin = 0, 
      volumeMax = 10000000,
      kdMin = 0,
      kdMax = 100,
      includeWords = [],
      excludeWords = [],
      intentFilter = []
    } = body;

    if (!seedKeyword) {
      return NextResponse.json({ error: `Seed keyword required` }, { status: 400 });
    }

    // Build Prisma Where Clause dynamically
    let keywordFilter: any = { contains: seedKeyword };
    
    if (matchType === `exact`) {
      keywordFilter = { equals: seedKeyword };
    } else if (matchType === `questions`) {
      keywordFilter = { 
        contains: seedKeyword,
        // Prisma does not support regex easily, so we use OR for question words
        OR: [
          { keywordText: { startsWith: `how ` } },
          { keywordText: { startsWith: `what ` } },
          { keywordText: { startsWith: `why ` } },
          { keywordText: { startsWith: `where ` } }
        ]
      };
    }

    const whereClause: any = {
      keywordText: keywordFilter,
      metrics: {
        searchVolume: { gte: volumeMin, lte: volumeMax }
      },
      difficulty: {
        kdScore: { gte: kdMin, lte: kdMax }
      }
    };

    // Include / Exclude logic
    if (includeWords.length > 0) {
      whereClause.AND = includeWords.map((word: string) => ({ keywordText: { contains: word } }));
    }
    if (excludeWords.length > 0) {
      whereClause.NOT = excludeWords.map((word: string) => ({ keywordText: { contains: word } }));
    }

    // Intent filtering
    if (intentFilter.length > 0) {
      whereClause.intent = {
        primaryIntent: { in: intentFilter }
      };
    }

    // Execute secure relational query
    const results = await prisma.keyword.findMany({
      where: whereClause,
      include: {
        metrics: true,
        difficulty: true,
        intent: true,
        serpFeatures: true,
        trends: {
          orderBy: { month: `asc` },
          take: 12
        }
      },
      orderBy: {
        metrics: { searchVolume: `desc` }
      },
      take: 100 // Pagination limit
    });

    // Format output to match SEMrush style rows
    const formattedData = results.map(row => ({
      keyword: row.keywordText,
      search_volume: row.metrics?.searchVolume || 0,
      cpc: row.metrics?.cpc || 0,
      competition_density: row.metrics?.competitionDensity || 0,
      kd_score: row.difficulty?.kdScore || 0,
      kd_label: row.difficulty?.difficultyLabel || `Unknown`,
      intent: row.intent?.primaryIntent || `Unknown`,
      serp_features: row.serpFeatures.map(f => f.featureType),
      trend: row.trends.map(t => t.searchVolume)
    }));

    return NextResponse.json({ success: true, count: formattedData.length, data: formattedData });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: `Database query failed` }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
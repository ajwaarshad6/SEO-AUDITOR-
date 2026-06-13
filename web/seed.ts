import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedData = [
  { keyword: 'seo software', volume: 14000, cpc: 12.50, density: 0.95, results: 12000000, kd: 85, label: 'Hard', intent: 'commercial' },
  { keyword: 'best seo software', volume: 8500, cpc: 15.00, density: 0.98, results: 45000000, kd: 90, label: 'Hard', intent: 'commercial' },
  { keyword: 'free seo tools', volume: 45000, cpc: 1.50, density: 0.60, results: 89000000, kd: 75, label: 'Hard', intent: 'informational' },
  { keyword: 'what is seo', volume: 120000, cpc: 4.50, density: 0.85, results: 150000000, kd: 88, label: 'Hard', intent: 'informational' },
];

async function runSeed() {
  console.log('Starting Prisma seed process...');
  try {
    for (const item of seedData) {
      await prisma.keyword.upsert({
        where: { keywordText: item.keyword },
        update: {},
        create: {
          keywordText: item.keyword,
          language: 'en',
          metrics: {
            create: { searchVolume: item.volume, cpc: item.cpc, competitionDensity: item.density, resultsCount: item.results }
          },
          difficulty: {
            create: { kdScore: item.kd, difficultyLabel: item.label }
          },
          intent: {
            create: { primaryIntent: item.intent, confidence: 0.95 }
          }
        }
      });
      console.log(`Successfully seeded: ${item.keyword}`);
    }
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runSeed();
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectName, keywordData } = body;

    if (!projectName || !keywordData) {
        return NextResponse.json({ success: false, error: `Missing data` }, { status: 400 });
    }

    const userId = `demo_user_1`;

    try {
        await (prisma as any).user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId, email: `demo@test.com`, name: `Demo User` }
        });
    } catch (e) {
        console.log(`Skipping user creation sync`);
    }

    let project = await (prisma as any).savedProject.findFirst({
        where: { name: projectName }
    });

    if (!project) {
        project = await (prisma as any).savedProject.create({
            data: {
                name: projectName,
                userId: userId
            }
        });
    }

    // Now capturing and saving every single metric to Supabase
    const newItem = await (prisma as any).projectItem.create({
        data: {
            projectId: project.id,
            keyword: keywordData.keyword,
            volume: Number(keywordData.volume) || 0,
            difficulty: Number(keywordData.difficulty) || 0,
            cpc: Number(keywordData.cpc) || 0,
            intent: keywordData.intent || `Unknown`,
            competitiveDensity: Number(keywordData.competitiveDensity) || 0,
            results: String(keywordData.results || `0`),
            serpFeatures: keywordData.serpFeatures || `[]`,
            trend: keywordData.trend || `[]`,
            clickPotential: Number(keywordData.clickPotential) || 0,
            competitors: keywordData.competitors || `[]`,
        }
    });

    return NextResponse.json({ success: true, item: newItem });
  } catch (error: any) {
    console.error(`Project Item Save Error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
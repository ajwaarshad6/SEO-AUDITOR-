import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { domain, healthScore, stats, backlinks } = body;

    if (!domain || !backlinks || !Array.isArray(backlinks)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid payload' }, { status: 400 });
    }

    const userId = 'demo_user_1';

    // 1. Find or create the master Backlink Project for this domain
    let project = await (prisma as any).backlinkProject.findUnique({
        where: { domain: domain }
    });

    if (!project) {
        project = await (prisma as any).backlinkProject.create({
            data: {
                domain: domain,
                userId: userId,
                latestScore: healthScore || 0
            }
        });
    } else {
        // Update Project with latest score
        await (prisma as any).backlinkProject.update({
            where: { id: project.id },
            data: { latestScore: healthScore || 0 }
        });
    }

    // 2. Create the specific Scan History entry
    const scan = await (prisma as any).backlinkScan.create({
        data: {
            projectId: project.id,
            healthScore: healthScore || 0,
            totalBacklinks: stats?.totalBacklinks || 0,
            referringDomains: stats?.referringDomains || 0,
            toxicLinks: stats?.toxicLinks || 0,
        }
    });

    // 3. Batch insert all the scraped backlinks
    if (backlinks.length > 0) {
        const linkPayload = backlinks.map((link: any) => ({
            scanId: scan.id,
            sourceUrl: link.sourceUrl || 'Unknown',
            sourceTitle: link.sourceTitle || '',
            targetUrl: link.targetUrl || '',
            anchor: link.anchor || '',
            type: link.type || 'Text',
            authority: link.authority || 0,
            spamScore: link.spamScore || 0,
            bertIntent: link.bert_intent || 'Unknown',
            xgboostRisk: link.xgboost_risk || 0,
            classification: link.classification || 'Safe',
            isToxic: link.isToxic || false,
            firstSeen: link.firstSeen || ''
        }));

        await (prisma as any).backlinkRecord.createMany({
            data: linkPayload
        });
    }

    return NextResponse.json({ success: true, scanId: scan.id, message: 'Backlink audit securely saved to Supabase' });

  } catch (error: any) {
    console.error('Supabase Backlink Save Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
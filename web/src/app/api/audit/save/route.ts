import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Prevent Next.js from cutting off the database save
export const maxDuration = 120;
const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { domain, results } = body;

    if (!domain || !results || !Array.isArray(results)) {
      return NextResponse.json({ success: false, error: `Missing or invalid payload` }, { status: 400 });
    }

    const safeResults = JSON.parse(JSON.stringify(results));
    const userId = `demo_user_1`;

    let project = await (prisma as any).auditProject.findUnique({
        where: { domain: domain }
    });

    if (!project) {
        project = await (prisma as any).auditProject.create({
            data: {
                domain: domain,
                userId: userId,
                latestScore: 0
            }
        });
    }

    let totalScore = 0;
    let criticals = 0;
    let warnings = 0;

    safeResults.forEach((page: any) => {
        totalScore += (page.audit_score || 0);
        const issues = page.audit_issues || [];
        issues.forEach((issue: any) => {
            if (issue.severity === `critical` || issue.severity === `high`) criticals++;
            if (issue.severity === `medium`) warnings++;
        });
    });

    const avgScore = safeResults.length > 0 ? Math.round(totalScore / safeResults.length) : 0;

    await (prisma as any).auditProject.update({
        where: { id: project.id },
        data: { latestScore: avgScore }
    });

    const scan = await (prisma as any).auditScan.create({
        data: {
            projectId: project.id,
            totalScanned: safeResults.length,
            averageScore: avgScore,
            criticalCount: criticals,
            warningCount: warnings
        }
    });

    // 🚀 THE FIX: CONTROLLED BATCHING
    // Processes 5 pages at a time. It is 5x faster than a normal loop, 
    // but prevents the Supabase connection pool from crashing.
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < safeResults.length; i += BATCH_SIZE) {
        const batch = safeResults.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (page: any) => {
            const savedPage = await (prisma as any).auditPage.create({
                data: {
                    scanId: scan.id,
                    url: page.url || `Unknown`,
                    status: page.status || 200,
                    title: page.data?.title || ``,
                    metaDesc: page.data?.desc || ``,
                    h1Count: page.data?.h1Count || 0,
                    readabilityScore: page.readability_score || 0,
                    auditScore: page.audit_score || 0,
                    healthLabel: page.health_label || `Unknown`,
                    isOrphan: page.is_orphan || false,
                    isDuplicateTitle: page.is_duplicate_title || false,
                    isDuplicateDesc: page.is_duplicate_desc || false
                }
            });

            const issues = page.audit_issues || [];
            if (issues.length > 0) {
                const issuePayload = issues.map((issue: any) => ({
                    pageId: savedPage.id,
                    severity: issue.severity || `low`,
                    message: issue.message || `Unknown issue`
                }));
                
                await (prisma as any).auditIssue.createMany({
                    data: issuePayload
                });
            }
        }));
    }

    return NextResponse.json({ success: true, scanId: scan.id, message: `Audit securely saved to Supabase` });

  } catch (error: any) {
    console.error(`Supabase Audit Save Error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
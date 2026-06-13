import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    // Extract the domain from the URL query (e.g., ?domain=apple.com)
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');

    if (!domain) {
      return NextResponse.json({ success: false, error: 'Domain required' }, { status: 400 });
    }

    // Find the master project for this domain in Supabase
    const project = await (prisma as any).backlinkProject.findUnique({
      where: { domain: domain },
      select: { latestScore: true }
    });

    // If found, return the score. If they haven't run a backlink audit yet, return 0.
    return NextResponse.json({ success: true, score: project?.latestScore || 0 });

  } catch (error: any) {
    console.error('Fetch Backlink Score Error:', error);
    return NextResponse.json({ success: false, score: 0 });
  } finally {
    await prisma.$disconnect();
  }
}
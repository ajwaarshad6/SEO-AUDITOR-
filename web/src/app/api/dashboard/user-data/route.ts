// src/app/api/dashboard/user-data/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = "demo_user_1"; 

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
        projects: {
          include: { items: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const scans = await prisma.scan.findMany({
      orderBy: { scannedAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      history: user?.history || [],
      projects: user?.projects || [],
      auditHistory: scans || []
    });
  } catch (error) {
    console.error("Dashboard Data Error:", error);
    return NextResponse.json({ history: [], projects: [], auditHistory: [] });
  }
}
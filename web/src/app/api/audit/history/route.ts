import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const userId = `demo_user_1`;

    const projects = await (prisma as any).auditProject.findMany({
        where: { userId: userId },
        include: {
            scans: {
                orderBy: { scannedAt: `desc` },
                take: 1, 
                include: {
                    pages: {
                        where: {
                            issues: { some: {} } 
                        },
                        include: {
                            issues: true
                        }
                    }
                }
            }
        },
        orderBy: { updatedAt: `desc` }
    });

    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    console.error(`Fetch Audit History Error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
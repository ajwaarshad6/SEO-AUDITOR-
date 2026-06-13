import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const userId = `demo_user_1`;
    
    const projects = await (prisma as any).savedProject.findMany({
        where: { userId: userId },
        orderBy: { createdAt: `desc` }
    });

    const projectIds = projects.map((p: any) => p.id);

    const items = await (prisma as any).projectItem.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { volume: `desc` }
    });

    const projectsWithItems = projects.map((project: any) => {
        return {
            ...project,
            items: items.filter((item: any) => item.projectId === project.id)
        };
    });

    return NextResponse.json({ success: true, projects: projectsWithItems });
  } catch (error: any) {
    console.error(`Fetch Projects Error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
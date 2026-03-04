import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: Request) {
  try {
     const { type, id } = await req.json(); // type: 'history' | 'project'

     if(type === 'history') {
         await prisma.searchHistory.delete({ where: { id } });
     } else if (type === 'project') {
         // Delete items first (cascade usually handles this, but being safe)
         await prisma.projectItem.deleteMany({ where: { projectId: id } });
         await prisma.savedProject.delete({ where: { id } });
     }

     return NextResponse.json({ success: true });
  } catch(e) {
     console.error("Delete Error:", e);
     return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// In Next.js 15, params is a Promise
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    // We MUST await the params object here
    const resolvedParams = await context.params;
    const jobId = resolvedParams.id;
    
    if (!jobId) {
      return NextResponse.json({ error: "No Job ID provided" }, { status: 400 });
    }

    const job = await prisma.competitorJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found in database" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error: any) {
    return NextResponse.json({ error: `Database Error: ${error.message}` }, { status: 500 });
  }
}
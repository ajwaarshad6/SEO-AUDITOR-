import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, status, resultData, errorMessage } = body;

    const updatedJob = await prisma.competitorJob.update({
      where: { id: jobId },
      data: {
        status: status,
        resultData: resultData,
        errorMessage: errorMessage,
      },
    });

    return NextResponse.json(updatedJob);
  } catch (error) {
    return NextResponse.json({ error: "failed to update" }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; 
import { createClient } from 'celery-node';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const celery = createClient(
  'rediss://default:Aa5rAAIncDI1NzY5ZGM2N2JmNTU0ODQyOGU1NGQ5Y2Y0NWJlMmE2YXAyNDQ2NTE@valid-imp-44651.upstash.io:6379',
  'rediss://default:Aa5rAAIncDI1NzY5ZGM2N2JmNTU0ODQyOGU1NGQ5Y2Y0NWJlMmE2YXAyNDQ2NTE@valid-imp-44651.upstash.io:6379'
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const domain = body.domain;
    const competitors = body.competitors;

    if (!domain) {
      return NextResponse.json({ error: 'Domain required' }, { status: 400 });
    }

    const jobId = randomUUID();
    const targets = [domain, ...competitors].filter(Boolean).join(',');

    await prisma.competitorJob.create({
      data: {
        id: jobId,
        domain: domain,
        status: 'PROCESSING'
      }
    });

    const task = celery.createTask('tasks.run_enterprise_crawl');
    task.delay(jobId, domain, targets);

    return NextResponse.json({ jobId: jobId, message: 'Job sent to distributed queue' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    // THE FIX: Directly check if the JSON report file exists on the hard drive
    const filePath = path.join(process.cwd(), 'public', 'reports', `${jobId}.json`);
    if (fs.existsSync(filePath)) {
        return NextResponse.json({
            status: 'COMPLETED',
            resultUrl: `/reports/${jobId}.json`,
            errorMessage: null
        });
    }

    // Fallback to checking the database
    const result = await prisma.competitorJob.findUnique({
      where: { id: jobId },
      select: { status: true, resultUrl: true, errorMessage: true }
    });

    if (!result) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
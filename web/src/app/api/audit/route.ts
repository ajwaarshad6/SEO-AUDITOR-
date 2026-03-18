import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

    // Trigger Python
    try {
        await fetch(`http://127.0.0.1:8000/start_deep_crawl?url=${url}`, { method: 'POST' });
    } catch (e) {
        return NextResponse.json({ error: "AI Server Offline" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Scan Started" });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
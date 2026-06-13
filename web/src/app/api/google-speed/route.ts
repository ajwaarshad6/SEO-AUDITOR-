import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { url } = body;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // 1. Robust URL Normalization
    const cleanDomain = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    const finalUrl = `https://www.${cleanDomain}`;

    // 2. Check for Key
    if (!apiKey) {
        console.error("Error: Missing GOOGLE_API_KEY in .env");
        return NextResponse.json({ performance: 0, accessibility: 0, seo: 0, lcp: '--', cls: '--' });
    }

    console.log(`[Google API] Scanning: ${finalUrl}`);

    // --- THE FIX IS HERE: Explicitly ask for ALL categories ---
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${finalUrl}&strategy=mobile&category=performance&category=accessibility&category=seo&key=${apiKey}`;
    
    const res = await fetch(endpoint);
    const data = await res.json();

    // 4. Handle Google API Errors
    if (data.error) {
        console.error(`[Google API Error]: ${data.error.message}`);
        return NextResponse.json({ performance: 0, accessibility: 0, seo: 0, lcp: '--', cls: '--' });
    }

    // 5. Extract Scores Safely
    const lighthouse = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;

    if (!lighthouse || !audits) {
        console.error("[Google API] No lighthouse data received.");
        return NextResponse.json({ performance: 0, accessibility: 0, seo: 0, lcp: '--', cls: '--' });
    }

    // Use optional chaining (?.) to prevent crashes
    const performance = lighthouse.performance?.score ? Math.round(lighthouse.performance.score * 100) : 0;
    const accessibility = lighthouse.accessibility?.score ? Math.round(lighthouse.accessibility.score * 100) : 0;
    const seo = lighthouse.seo?.score ? Math.round(lighthouse.seo.score * 100) : 0;
    
    // Core Web Vitals
    const lcp = audits['largest-contentful-paint']?.displayValue || '--';
    const cls = audits['cumulative-layout-shift']?.displayValue || '--';

    return NextResponse.json({
        performance,
        accessibility,
        seo,
        lcp,
        cls
    });

  } catch (error: any) {
    console.error("[Server Error] Google Route:", error.message);
    return NextResponse.json({ performance: 0, accessibility: 0, seo: 0, lcp: '--', cls: '--' });
  }
}
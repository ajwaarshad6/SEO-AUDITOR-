import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { domain = 'hubspot.com' } = await req.json();

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    const creds = Buffer.from(`${login}:${password}`).toString('base64');

    console.log(`[1] Fetching for: ${domain}`);

    const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        target: domain,
        location_code: 2840,
        language_name: "English"
      }])
    });

    const data = await response.json();

    // 1. Check for API Errors
    if (data.tasks?.[0]?.status_message !== 'Ok.') {
         // Note: DataForSEO returns "Ok." with a dot
         console.warn("[API Status]:", data.tasks?.[0]?.status_message);
    }

    // 2. Extract Data Safely
    const firstItem = data.tasks?.[0]?.result?.[0]?.items?.[0];

    if (!firstItem) {
        console.warn("[API] No data found for this domain.");
        return NextResponse.json({ organic_traffic: 0, organic_keywords: 0, visibility: 0 });
    }

    // --- CRITICAL FIX: Correct Data Mapping ---
    // DataForSEO nests organic data under 'metrics.organic'
    const organic = firstItem.metrics?.organic || {};
    const paid = firstItem.metrics?.paid || {};

    const traffic = organic.etv || 0;     // etv = Estimated Traffic Volume
    const keywords = organic.count || 0;  // count = Keyword Count

    console.log(`[Success] Traffic: ${traffic}, Keywords: ${keywords}`);

    return NextResponse.json({
      organic_traffic: traffic,
      organic_keywords: keywords,
      visibility: traffic, 
      paid_traffic: paid.etv || 0
    });

  } catch (error: any) {
    console.error("[Server Error]", error);
    return NextResponse.json({ organic_traffic: 0, organic_keywords: 0, visibility: 0 });
  }
}
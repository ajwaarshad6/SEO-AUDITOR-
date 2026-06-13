import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();
    let url = domain;
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    const creds = Buffer.from(`${login}:${password}`).toString('base64');

    console.log(`[Audit] Starting Instant Scan for: ${url}`);

    const response = await fetch('https://api.dataforseo.com/v3/on_page/instant_pages', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        url: url,
        enable_javascript: false,
        check_spell: false,
        custom_user_agent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
      }])
    });

    const data = await response.json();
    const statusMsg = data.tasks?.[0]?.status_message;

    console.log("[Audit API Status]:", statusMsg);

    // --- CRITICAL FIX: Handle Payment Error ---
    if (statusMsg === 'Payment Required.' || data.tasks?.[0]?.status_code === 40200) {
        console.warn("[Audit] Insufficient funds in DataForSEO account.");
        return NextResponse.json({ 
            instant: true, 
            score: 0, 
            errors: 0,
            payment_error: true // Flag to tell frontend
        });
    }

    if (statusMsg !== 'Ok.') {
        console.error("[Audit API Error]:", JSON.stringify(data));
        return NextResponse.json({ error: 'API Provider Error', details: statusMsg });
    }

    // Success Case
    const pageMetrics = data.tasks[0].result?.[0]?.items?.[0];

    if (!pageMetrics) {
        return NextResponse.json({ instant: true, score: 0, errors: 0 });
    }

    return NextResponse.json({ 
        instant: true, 
        score: pageMetrics.onpage_score || 0,
        errors: (pageMetrics.meta?.internal_server_error_count || 0) + (pageMetrics.meta?.broken_links_count || 0)
    });

  } catch (error: any) {
    console.error("[Server Audit Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
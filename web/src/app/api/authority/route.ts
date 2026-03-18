import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    // 1. Extract Domain (e.g., "https://www.blackzero.org" -> "blackzero.org")
    let domain = url;
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
        // Fallback if URL is invalid
        domain = url.replace('www.', '');
    }

    // 2. Get API Key
    const apiKey = process.env.OPEN_PAGERANK_KEY;
    
    if (!apiKey) {
        console.error("Error: OPEN_PAGERANK_KEY is missing in .env file");
        return NextResponse.json({ error: "API Key Missing" }, { status: 500 });
    }

    // 3. Fetch from OpenPageRank
    const res = await fetch(`https://openpagerank.com/api/v1.0/getPageRank?domains%5B0%5D=${domain}`, {
        headers: {
            'API-OPR': apiKey
        }
    });

    const data = await res.json();
    
    // 4. Extract Result
    // The API returns dynamic keys (e.g. "google.com"), so we access the first one available
    let score = 0;
    let rank = "N/A";

    if (data.response && Array.isArray(data.response) && data.response.length > 0) {
        const result = data.response[0];
        score = result.page_rank_decimal || 0;
        rank = result.rank || "N/A";
    }

    return NextResponse.json({
        score: score,  
        rank: rank 
    });

  } catch (error: any) {
    console.error("Authority API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
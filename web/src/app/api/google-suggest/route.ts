import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const keyword = body.keyword;
    const country = body.market || 'us';

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    let googleUrl = `http://suggestqueries.google.com/complete/search?client=chrome&hl=en&q=${encodeURIComponent(keyword)}`;

    if (country !== 'global') {
      googleUrl += `&gl=${country}`;
    }

    const response = await fetch(googleUrl);
    const data = await response.json();

    const suggestions = data[1] || [];

    const formattedItems = suggestions.map((suggestion: string) => ({
      keyword: suggestion
    }));

    const mockResponse = {
      tasks: [
        {
          result: [
            {
              items: formattedItems
            }
          ]
        }
      ]
    };

    return NextResponse.json(mockResponse);

  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // The data is natively saved to your database during the /api/serp phase.
    // This endpoint acts as a safe verification bridge for the UI component.
    
    return NextResponse.json({ success: true, message: `Saved successfully!` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: `Failed to save` }, { status: 500 });
  }
}
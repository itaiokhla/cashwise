'use server'
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { ledger } = await req.json();

    // Forward request to Tally API
    const tallyResponse = await fetch('https://api.api2books.com/api/User/LedgerMaster', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': 'live_b51617d54e33402abaec4e0278a3a1e3',
        'Template-Key': '16',
        'CompanyName': 'Intertech',
        'version': '5',
      },
      body: JSON.stringify({
        body: [ledger],
      }),
    });

    const data = await tallyResponse.json();

    if (!tallyResponse.ok) {
      return NextResponse.json(
        { success: false, message: 'Tally API error', data },
        { status: tallyResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Tally sync error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
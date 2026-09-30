'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { entries } = await req.json();

    if (!Array.isArray(entries) || entries.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Minimum 2 journal entries required' },
        { status: 400 }
      );
    }

    // 🔒 Normalize EXACTLY like Postman
    const body = entries.map(e => ({
      Date: e.Date, // YYYYMMDD
      'Voucher Type': 'Journal',
      'Voucher Number': e['Voucher Number'],
      'Ledger Name': e['Ledger Name'], // MUST EXIST IN TALLY
      'Debit / Credit': e['Debit / Credit'],
      Amount: Number(e.Amount),
      Narration: e.Narration || ''
    }));

    console.log('FINAL BODY SENT TO TALLY 👇');
    console.log(JSON.stringify({ body }, null, 2));

    const tallyResponse = await fetch(
      'https://api.api2books.com/api/User/JournalTemplate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Key': 'live_b51617d54e33402abaec4e0278a3a1e3',
          'Template-Key': '18',
          'CompanyName': 'Intertech',
          'version': '5'
        },
        body: JSON.stringify({ body })
      }
    );

    const data = await tallyResponse.json();

    return NextResponse.json({
      success: tallyResponse.ok,
      data
    });

  } catch (error: any) {
    console.error('Tally sync error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

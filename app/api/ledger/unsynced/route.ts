'use server';
// api/vouchers/unsynced/route.ts

import dbConnect from '@app/_database/db';
import Ledger from '@app/_model/ledger.schema';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // Fetch ledgers where tallyIntegration is false
    const ledgers = await Ledger.find({
      tallyIntegration: false,
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: ledgers,
      count: ledgers.length,
    });
  } catch (error: any) {
    console.error('Error fetching unsynced ledgers:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

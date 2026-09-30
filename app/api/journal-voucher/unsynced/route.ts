'use server';
// api/vouchers/unsynced/route.ts

import dbConnect from '@app/_database/db';
import JournalVoucher from '@app/_model/journalVoucher.schema';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // Fetch vouchers where tallyIntegration is false
    const vouchers = await JournalVoucher.find({
      tallyIntegration: false,
      voucherType: 'Journal',
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: vouchers,
      count: vouchers.length,
    });
  } catch (error: any) {
    console.error('Error fetching unsynced vouchers:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

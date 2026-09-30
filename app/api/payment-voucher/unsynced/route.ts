'use server';

// api/payment-vouchers/unsynced/route.ts
import dbConnect from '@app/_database/db';
import PaymentVoucher from '@app/_model/paymentVoucher.schema';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // Fetch payment vouchers where tallyIntegration is false
    const vouchers = await PaymentVoucher.find({
      tallyIntegration: false,
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: vouchers,
      count: vouchers.length,
    });
  } catch (error: any) {
    console.error('Error fetching unsynced payment vouchers:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

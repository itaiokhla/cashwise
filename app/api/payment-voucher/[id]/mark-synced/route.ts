'use server';

// api/payment-vouchers/[id]/mark-synced/route.ts
import dbConnect from '@app/_database/db';
import PaymentVoucher from '@app/_model/paymentVoucher.schema';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // 🔥 Changed to Promise
) {
  try {
    await dbConnect();

    const body = await req.json();
    const { id } = await params; // 🔥 Await params here

    const updatedVoucher = await PaymentVoucher.findByIdAndUpdate(
      id,
      {
        tallyIntegration: body.tallyIntegration,
        tallyIntegrationDate: body.tallyIntegrationDate,
      },
      { new: true }
    );

    if (!updatedVoucher) {
      return NextResponse.json(
        { success: false, message: 'Payment voucher not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedVoucher,
    });
  } catch (error: any) {
    console.error('Error marking payment voucher as synced:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

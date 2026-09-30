'use server';

// api/vouchers/[id]/mark-synced/route.ts
import dbConnect from '@app/_database/db';
import Ledger from '@app/_model/ledger.schema';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // 🔥 Changed to Promise
) {
  try {
    await dbConnect();

    const body = await req.json();
    const { id } = await params; // 🔥 Await params here

    const updatedLedger = await Ledger.findByIdAndUpdate(
      id,
      {
        tallyIntegration: body.tallyIntegration,
        tallyIntegrationDate: body.tallyIntegrationDate,
      },
      { new: true }
    );

    if (!updatedLedger) {
      return NextResponse.json(
        { success: false, message: 'Ledger not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedLedger,
    });
  } catch (error: any) {
    console.error('Error marking ledger as synced:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
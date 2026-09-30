'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { entries } = await req.json();

    // entries expected from your DB / UI:
    // {
    //   date, voucherNumber, cashBankLedgerName, instrumentType, instrumentNumber?, instrumentDate?, recoDate?, narration?, entries:[{ledgerName,debitCredit,amount}]
    // }

    if (!Array.isArray(entries) || entries.length < 1) {
      return NextResponse.json(
        { success: false, message: 'Minimum 1 payment voucher required' },
        { status: 400 }
      );
    }

    // ✅ Normalize EXACTLY like API2Books PaymentVoucher expects
    const body = entries.map((e: any) => ({
      "Voucher Date": e["Voucher Date"] || e.voucherDate || e.date, // accept ISO date
      "Voucher Number": e["Voucher Number"] ?? e.voucherNumber,
      "Voucher Type": "Payment",
      "Cash/Bank Ledger": e["Cash/Bank Ledger"] || e.cashBankLedgerName,
      "Debit Ledgers": e["Debit Ledgers"] || e.debitLedgers || e.partyLedgerName || e.debitLedgerName,
      "Amount": Number(e.Amount ?? e.amount ?? 0),
      "Instrument Type": e["Instrument Type"] || e.instrumentType,
      "Instrument Number": e["Instrument Number"] ?? e.instrumentNumber ?? undefined,
      "Instrument Date": e["Instrument Date"] || e.instrumentDate || undefined,
      "Reco Date": e["Reco Date"] || e.recoDate || undefined,
      "Bill Name": e["Bill Name"] || e.billName || undefined,
      "Cost Center": e["Cost Center"] || e.costCenter || undefined,
      "Narration": e["Narration"] || e.narration || ""
    }));

    // remove undefined keys (API sometimes rejects undefined)
    const cleanedBody = body.map((row: any) =>
      Object.fromEntries(Object.entries(row).filter(([_, v]) => v !== undefined && v !== null && v !== ""))
    );

    console.log('FINAL BODY SENT TO TALLY (PAYMENT) 👇');
    console.log(JSON.stringify({ body: cleanedBody }, null, 2));

    const tallyResponse = await fetch(
      'https://api.api2books.com/api/User/PaymentVoucher',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Key': 'live_b51617d54e33402abaec4e0278a3a1e3',
          'Template-Key': '13', // <-- set your Payment template id here (you mentioned TemplateID 13 earlier)
          'CompanyName': 'Intertech',
          'version': '5'
        },
        body: JSON.stringify({ body: cleanedBody })
      }
    );
    const data = await tallyResponse.json();

    return NextResponse.json({
      success: tallyResponse.ok,
      data
    });

  } catch (error: any) {
    console.error('Tally payment sync error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

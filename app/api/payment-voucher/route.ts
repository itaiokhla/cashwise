'use server';
// api/payment-voucher/route.ts
import DB from "@app/_database/db";
import DataWithDate from "@app/_model/datawithdate.modal";
import Ledger from "@app/_model/ledger.schema";
import PaymentVoucher from "@app/_model/paymentVoucher.schema";
import { NextRequest, NextResponse } from "next/server";

// Initialize database connection
(async function initializeDB() {
  await DB();
})();

// Helper function to generate voucher number
async function generateVoucherNumber(userId: string) {
  const count = await PaymentVoucher.countDocuments({ userId });
  return `PV-${String(count + 1).padStart(4, "0")}`;
}

// CREATE - POST
export async function POST(req: NextRequest) {
  const userHeader = req.headers.get("user");
  const authUser: any = userHeader ? JSON.parse(userHeader) : null;



  try {
    const {
      date,
      entries,
      narration,
      voucherNumber,

      // payment specific
      cashBankLedgerName,
      instrumentType,
      instrumentNumber,
      instrumentDate,
      recoDate,
    } = await req.json();

    // Validation
    if (!cashBankLedgerName || !cashBankLedgerName.trim()) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "Cash/Bank Ledger is required!" },
        { status: 400 }
      );
    }

    if (!instrumentType || !instrumentType.trim()) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "Instrument Type is required!" },
        { status: 400 }
      );
    }

    if (!entries || entries.length < 2) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "At least 2 entries (Dr and Cr) are required!",
        },
        { status: 400 }
      );
    }

    // Validate ledger existence for cash/bank ledger
    const cashBankLedger = await Ledger.findOne({
      ledgerName: cashBankLedgerName,
      userId: authUser._id,
      isActive: true,
    });

    if (!cashBankLedger) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: `Cash/Bank Ledger "${cashBankLedgerName}" not found!`,
        },
        { status: 404 }
      );
    }

    // Validate entries + attach ledgerId
    for (const entry of entries) {
      if (!entry.ledgerName || !entry.debitCredit || !entry.amount) {
        return NextResponse.json(
          { type: "BAD_REQUEST", message: "All entry fields are required!" },
          { status: 400 }
        );
      }
      if (entry.debitCredit === "Dr" && (!entry.description || !entry.description.trim())) {
        return NextResponse.json(
          { type: "BAD_REQUEST", message: `Description is required for credit entry: ${entry.ledgerName}` },
          { status: 400 }
        );
      }
      if (entry.debitCredit === "Cr" && (!entry.remarks || !entry.remarks.trim())) {
        return NextResponse.json(
          { type: "BAD_REQUEST", message: `Remarks is required for debit entry: ${entry.ledgerName}` },
          { status: 400 }
        );
      }
      const ledger = await Ledger.findOne({
        ledgerName: entry.ledgerName,
        userId: authUser._id,
        isActive: true,
      });

      if (!ledger) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: `Ledger "${entry.ledgerName}" not found!`,
          },
          { status: 404 }
        );
      }

      entry.ledgerId = ledger._id;
    }

    // Payment rule: exactly one Credit entry & must be the cash/bank ledger
    const creditEntries = entries.filter((e: any) => e.debitCredit === "Cr");
    if (creditEntries.length !== 1) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Payment voucher must have exactly one Credit entry (Cash/Bank).",
        },
        { status: 400 }
      );
    }

    const creditLedgerName = (creditEntries[0]?.ledgerName || "").trim();
    if (creditLedgerName !== cashBankLedgerName.trim()) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message:
            'Credit entry ledgerName must match "cashBankLedgerName" (Cash/Bank account).',
        },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalDebit = entries
      .filter((e: any) => e.debitCredit === "Dr")
      .reduce((sum: any, e: any) => sum + Number(e.amount), 0);

    const totalCredit = entries
      .filter((e: any) => e.debitCredit === "Cr")
      .reduce((sum: any, e: any) => sum + Number(e.amount), 0);

    // Validate balanced entry
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: `Payment voucher is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
        },
        { status: 400 }
      );
    }

    // Generate voucher number if not provided
    const finalVoucherNumber =
      voucherNumber || (await generateVoucherNumber(authUser._id));

    // Check if voucher number already exists
    const existingVoucher = await PaymentVoucher.findOne({
      voucherNumber: finalVoucherNumber,
      userId: authUser._id,
    });

    if (existingVoucher) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "Voucher number already exists!" },
        { status: 400 }
      );
    }

    // Create payment voucher
    const paymentVoucher = new PaymentVoucher({
      voucherNumber: finalVoucherNumber,
      date: date || new Date(),
      voucherType: "Payment",

      cashBankLedgerName: cashBankLedgerName.trim(),
      cashBankLedgerId: cashBankLedger._id,

      instrumentType: instrumentType.trim(),
      instrumentNumber: instrumentNumber ? String(instrumentNumber).trim() : null,
      instrumentDate: instrumentDate ? new Date(instrumentDate) : null,
      recoDate: recoDate ? new Date(recoDate) : null,

      entries,
      narration: narration ? narration.trim() : "",
      totalAmount: totalDebit,
      userId: authUser._id,
    });

    const result = await paymentVoucher.save();

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Payment voucher created successfully",
        result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.log(error.message);
    return NextResponse.json(
      {
        type: "ERROR",
        message: error.message || "Something went wrong!",
      },
      { status: 500 }
    );
  }
}

// READ - GET
export async function GET(req: NextRequest) {
  const userHeader = req.headers.get("user");
  const authUser: any = userHeader ? JSON.parse(userHeader) : null;



  try {
    const searchUrl = new URL(req.url);
    const voucherNumber = searchUrl.searchParams.get("voucherNumber") || "";
    const fromDate = searchUrl.searchParams.get("fromDate");
    const toDate = searchUrl.searchParams.get("toDate");
    const status = searchUrl.searchParams.get("status");
    const ledgerName = searchUrl.searchParams.get("ledgerName");
    const cashBankLedgerName = searchUrl.searchParams.get("cashBankLedgerName");
    const instrumentType = searchUrl.searchParams.get("instrumentType");

    const filterQuery: any = {};
    const dateResult: any = await DataWithDate
      .findOne({})
      .sort({ createdAt: -1 });
    if (voucherNumber && voucherNumber.trim()) {
      filterQuery.voucherNumber = { $regex: voucherNumber, $options: "i" };
    }

    if (status) filterQuery.status = status;

    if (fromDate || toDate) {
      filterQuery.date = {};
      if (fromDate) filterQuery.date.$gte = new Date(fromDate);
      if (toDate) filterQuery.date.$lte = new Date(toDate);
    }

    if (ledgerName && ledgerName.trim()) {
      filterQuery["entries.ledgerName"] = { $regex: ledgerName, $options: "i" };
    }

    if (cashBankLedgerName && cashBankLedgerName.trim()) {
      filterQuery.cashBankLedgerName = { $regex: cashBankLedgerName, $options: "i" };
    }

    if (instrumentType && instrumentType.trim()) {
      filterQuery.instrumentType = { $regex: instrumentType, $options: "i" };
    }
    if (dateResult?.fromDate || dateResult?.toDate) {
      filterQuery.createdAt = {};
      if (dateResult.fromDate) {
        filterQuery.createdAt.$gte = new Date(dateResult.fromDate);
      }
      if (dateResult.toDate) {
        const end = new Date(dateResult.toDate);
        end.setHours(23, 59, 59, 999);
        filterQuery.createdAt.$lte = end;
      }
    }
    const vouchers = await PaymentVoucher.find(filterQuery)
      .populate("entries.ledgerId", "ledgerName groupName")
      .populate("cashBankLedgerId", "ledgerName groupName")
      .sort({ date: -1, createdAt: -1 });

    return NextResponse.json({
      type: "SUCCESS",
      data: vouchers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { type: "ERROR", message: error.message || "Something went wrong!" },
      { status: 500 }
    );
  }
}

// UPDATE - PUT
export async function PUT(req: NextRequest) {
  const userHeader = req.headers.get("user");
  const authUser: any = userHeader ? JSON.parse(userHeader) : null;

  if (authUser?.role !== "admin" && authUser?.role !== "manager") {
    return NextResponse.json(
      {
        type: "BAD_REQUEST",
        message: "You are not authorized to update payment voucher",
      },
      { status: 403 }
    );
  }

  try {
    const {
      _id,
      date,
      entries,
      narration,
      status,

      cashBankLedgerName,
      instrumentType,
      instrumentNumber,
      instrumentDate,
      recoDate,
    } = await req.json();

    if (!_id) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "Voucher ID is required!" },
        { status: 400 }
      );
    }

    const existingVoucher: any = await PaymentVoucher.findOne({
      _id,
      userId: authUser._id,
    });

    if (!existingVoucher) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "Payment voucher not found!" },
        { status: 404 }
      );
    }

    // Update cash/bank ledger if provided
    if (cashBankLedgerName && cashBankLedgerName.trim()) {
      const cashBankLedger = await Ledger.findOne({
        ledgerName: cashBankLedgerName,
        userId: authUser._id,
        isActive: true,
      });

      if (!cashBankLedger) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: `Cash/Bank Ledger "${cashBankLedgerName}" not found!`,
          },
          { status: 404 }
        );
      }

      existingVoucher.cashBankLedgerName = cashBankLedgerName.trim();
      existingVoucher.cashBankLedgerId = cashBankLedger._id;
    }

    // Update instrument fields if provided
    if (instrumentType && instrumentType.trim()) existingVoucher.instrumentType = instrumentType.trim();
    if (instrumentNumber !== undefined)
      existingVoucher.instrumentNumber =
        instrumentNumber === null || instrumentNumber === ""
          ? null
          : String(instrumentNumber).trim();
    if (instrumentDate !== undefined)
      existingVoucher.instrumentDate = instrumentDate ? new Date(instrumentDate) : null;
    if (recoDate !== undefined) existingVoucher.recoDate = recoDate ? new Date(recoDate) : null;

    // Validate entries if provided
    if (entries && entries.length >= 2) {
      for (const entry of entries) {
        const ledger = await Ledger.findOne({
          ledgerName: entry.ledgerName,
          userId: authUser._id,
          isActive: true,
        });

        if (!ledger) {
          return NextResponse.json(
            {
              type: "BAD_REQUEST",
              message: `Ledger "${entry.ledgerName}" not found!`,
            },
            { status: 404 }
          );
        }

        entry.ledgerId = ledger._id;
      }

      // Determine cash bank ledger name to validate credit line
      const cbName = (existingVoucher.cashBankLedgerName || "").trim();

      const creditEntries = entries.filter((e: any) => e.debitCredit === "Cr");
      if (creditEntries.length !== 1) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: "Payment voucher must have exactly one Credit entry (Cash/Bank).",
          },
          { status: 400 }
        );
      }

      const creditLedgerName = (creditEntries[0]?.ledgerName || "").trim();
      if (creditLedgerName !== cbName) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message:
              'Credit entry ledgerName must match "cashBankLedgerName" (Cash/Bank account).',
          },
          { status: 400 }
        );
      }

      // Balanced check
      const totalDebit = entries
        .filter((e: any) => e.debitCredit === "Dr")
        .reduce((sum: any, e: any) => sum + Number(e.amount), 0);

      const totalCredit = entries
        .filter((e: any) => e.debitCredit === "Cr")
        .reduce((sum: any, e: any) => sum + Number(e.amount), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: `Payment voucher is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
          },
          { status: 400 }
        );
      }

      existingVoucher.entries = entries;
      existingVoucher.totalAmount = totalDebit;
    }

    if (date) existingVoucher.date = new Date(date);
    if (narration !== undefined) existingVoucher.narration = narration ? narration.trim() : "";
    if (status) existingVoucher.status = status;

    const updatedVoucher = await existingVoucher.save();

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Payment voucher updated successfully",
        result: updatedVoucher,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.log(error.message);
    return NextResponse.json(
      { type: "ERROR", message: error.message || "Something went wrong!" },
      { status: 500 }
    );
  }
}

// DELETE - DELETE
export async function DELETE(req: NextRequest) {
  const userHeader = req.headers.get("user");
  const authUser: any = userHeader ? JSON.parse(userHeader) : null;

  if (authUser?.role !== "admin" && authUser?.role !== "manager") {
    return NextResponse.json(
      {
        type: "BAD_REQUEST",
        message: "You are not authorized to delete payment voucher",
      },
      { status: 403 }
    );
  }

  try {
    const searchUrl = new URL(req.url);
    const voucherId = searchUrl.searchParams.get("id");

    if (!voucherId) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "Voucher ID is required!" },
        { status: 400 }
      );
    }

    const voucher = await PaymentVoucher.findOne({
      _id: voucherId,
      userId: authUser._id,
    });

    if (!voucher) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "Payment voucher not found!" },
        { status: 404 }
      );
    }

    // Soft delete
    await PaymentVoucher.findByIdAndUpdate(voucherId, { status: "Cancelled" });

    return NextResponse.json(
      { type: "SUCCESS", message: "Payment voucher deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.log(error.message);
    return NextResponse.json(
      { type: "ERROR", message: error.message || "Something went wrong!" },
      { status: 500 }
    );
  }
}

'use server';
// api/journal-voucher/route.ts
import DB from "@app/_database/db";
import DataWithDate from "@app/_model/datawithdate.modal";
import JournalVoucher from "@app/_model/journalVoucher.schema";
import Ledger from "@app/_model/ledger.schema";
import { NextRequest, NextResponse } from "next/server";


// Initialize database connection
(async function initializeDB() {
  await DB();
})();

// Helper function to generate voucher number
async function generateVoucherNumber(userId: string) {
  const count = await JournalVoucher.countDocuments({ userId });
  return `JV-${String(count + 1).padStart(4, "0")}`;
}

// CREATE - POST
export async function POST(req: NextRequest) {
  const userHeader = req.headers.get("user");
  const authUser: any = userHeader ? JSON.parse(userHeader) : null;



  try {
    const { date, entries, narration, voucherNumber } = await req.json();

    // Validation
    if (!entries || entries.length < 2) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "At least 2 entries (Dr and Cr) are required!",
        },
        { status: 400 }
      );
    }

    if (!narration || !narration.trim()) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Narration is required!",
        },
        { status: 400 }
      );
    }

    // Validate entries
    for (const entry of entries) {
      if (!entry.ledgerName || !entry.debitCredit || !entry.amount) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: "All entry fields are required!",
          },
          { status: 400 }
        );
      }
      if (entry.debitCredit === "Dr" && (!entry.description || !entry.description.trim())) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: `Description is required for debit entry: ${entry.ledgerName}`,
          },
          { status: 400 }
        );
      }
      if (entry.debitCredit === "Cr" && (!entry.remarks || !entry.remarks.trim())) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: `Remarks is required for credit entry: ${entry.ledgerName}`,
          },
          { status: 400 }
        );
      }
      // Check if ledger exists
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
          message: `Journal voucher is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
        },
        { status: 400 }
      );
    }

    // Generate voucher number if not provided
    const finalVoucherNumber =
      voucherNumber || (await generateVoucherNumber(authUser._id));

    // Check if voucher number already exists
    const existingVoucher = await JournalVoucher.findOne({
      voucherNumber: finalVoucherNumber,
      userId: authUser._id,
    });

    if (existingVoucher) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Voucher number already exists!",
        },
        { status: 400 }
      );
    }

    // Create journal voucher
    const journalVoucher = new JournalVoucher({
      voucherNumber: finalVoucherNumber,
      date: date || new Date(),
      voucherType: "Journal",
      entries,
      narration: narration.trim(),
      totalAmount: totalDebit,
      userId: authUser._id,
    });

    const result = await journalVoucher.save();

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Journal voucher created successfully",
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

    const filterQuery: any = {};
    const dateResult: any = await DataWithDate
      .findOne({})
      .sort({ createdAt: -1 });
    if (voucherNumber && voucherNumber.trim()) {
      filterQuery.voucherNumber = { $regex: voucherNumber, $options: "i" };
    }

    if (status) {
      filterQuery.status = status;
    }

    if (fromDate || toDate) {
      filterQuery.date = {};
      if (fromDate) filterQuery.date.$gte = new Date(fromDate);
      if (toDate) filterQuery.date.$lte = new Date(toDate);
    }

    if (ledgerName && ledgerName.trim()) {
      filterQuery["entries.ledgerName"] = { $regex: ledgerName, $options: "i" };
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
    const vouchers = await JournalVoucher.find(filterQuery)
      .populate("entries.ledgerId", "ledgerName groupName")
      .sort({ date: -1, createdAt: -1 });

    return NextResponse.json({
      type: "SUCCESS",
      data: vouchers,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        type: "ERROR",
        message: error.message || "Something went wrong!",
      },
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
        message: "You are not authorized to update journal voucher",
      },
      { status: 403 }
    );
  }

  try {
    const { _id, date, entries, narration, status } = await req.json();

    if (!_id) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Voucher ID is required!",
        },
        { status: 400 }
      );
    }

    // Check if voucher exists
    const existingVoucher: any = await JournalVoucher.findOne({
      _id,
      userId: authUser._id,
    });

    if (!existingVoucher) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Journal voucher not found!",
        },
        { status: 404 }
      );
    }

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
        if (entry.debitCredit === "Dr" && (!entry.description || !entry.description.trim())) {
          return NextResponse.json(
            {
              type: "BAD_REQUEST",
              message: `Description is required for debit entry: ${entry.ledgerName}`,
            },
            { status: 400 }
          );
        }
        if (entry.debitCredit === "Cr" && (!entry.remarks || !entry.remarks.trim())) {
          return NextResponse.json(
            {
              type: "BAD_REQUEST",
              message: `Remarks is required for credit entry: ${entry.ledgerName}`,
            },
            { status: 400 }
          );
        }
        entry.ledgerId = ledger._id;
      }

      // Validate balanced entry
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
            message: `Journal voucher is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
          },
          { status: 400 }
        );
      }

      existingVoucher.entries = entries;
      existingVoucher.totalAmount = totalDebit;
    }

    if (date) existingVoucher.date = new Date(date);
    if (narration) existingVoucher.narration = narration.trim();
    if (status) existingVoucher.status = status;

    const updatedVoucher = await existingVoucher.save();

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Journal voucher updated successfully",
        result: updatedVoucher,
      },
      { status: 200 }
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

// DELETE - DELETE
export async function DELETE(req: NextRequest) {
  const userHeader = req.headers.get("user");
  const authUser: any = userHeader ? JSON.parse(userHeader) : null;

  if (authUser?.role !== "admin" && authUser?.role !== "manager") {
    return NextResponse.json(
      {
        type: "BAD_REQUEST",
        message: "You are not authorized to delete journal voucher",
      },
      { status: 403 }
    );
  }

  try {
    const searchUrl = new URL(req.url);
    const voucherId = searchUrl.searchParams.get("id");

    if (!voucherId) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Voucher ID is required!",
        },
        { status: 400 }
      );
    }

    // Check if voucher exists
    const voucher = await JournalVoucher.findOne({
      _id: voucherId,
      userId: authUser._id,
    });

    if (!voucher) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Journal voucher not found!",
        },
        { status: 404 }
      );
    }

    // Soft delete - change status to Cancelled
    await JournalVoucher.findByIdAndUpdate(voucherId, { status: "Cancelled" });

    // Or hard delete - uncomment below
    // await JournalVoucher.findByIdAndDelete(voucherId);

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Journal voucher deleted successfully",
      },
      { status: 200 }
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
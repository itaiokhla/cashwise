export const maxDuration = 60;
import DB from "@app/_database/db";
import DataWithDate from "@app/_model/datawithdate.modal";
import Ledger from "@app/_model/ledger.schema";
import { NextRequest, NextResponse } from "next/server";

// Initialize database connection
(async function initializeDB() {
  await DB();
})();

// CREATE - POST
export async function POST(req: NextRequest) {
  const userHeader = req.headers.get("user");
  const authUser: any = userHeader ? JSON.parse(userHeader) : null;

  if (authUser?.role !== "admin" && authUser?.role !== "manager") {
    return NextResponse.json(
      {
        type: "BAD_REQUEST",
        message: "You are not authorized to create ledger",
      },
      { status: 403 }
    );
  }

  try {
    const { ledgerName, groupName = "Indirect Expenses" } = await req.json();

    // Validate ledger name
    if (!ledgerName || !ledgerName.trim()) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Ledger name is required!",
        },
        { status: 400 }
      );
    }

    // Check if ledger already exists
    const existingLedger = await Ledger.findOne({
      ledgerName: ledgerName.trim(),
      userId: authUser._id,
    });

    if (existingLedger) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Ledger with this name already exists!",
        },
        { status: 400 }
      );
    }

    // Create new ledger
    const ledger = new Ledger({
      ledgerName: ledgerName.trim(),
      groupName: groupName || "Indirect Expenses",
      userId: authUser._id,
    });

    const result = await ledger.save();

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Ledger created successfully",
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
    const ledgerName = searchUrl.searchParams.get("ledgerName") || "";
    const groupName = searchUrl.searchParams.get("groupName") || "";
    const isActive = searchUrl.searchParams.get("isActive");

    const filterQuery: any = {};
    const dateResult: any = await DataWithDate
      .findOne({})
      .sort({ createdAt: -1 }); if (ledgerName && ledgerName.trim()) {
        filterQuery.ledgerName = { $regex: ledgerName, $options: "i" };
      }

    if (groupName && groupName.trim()) {
      filterQuery.groupName = groupName;
    }

    if (isActive !== null && isActive !== undefined) {
      filterQuery.isActive = isActive === "true";
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
    const ledgers = await Ledger.find(filterQuery).sort({ createdAt: -1 });
    return NextResponse.json({
      type: "SUCCESS",
      data: ledgers,
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
        message: "You are not authorized to update ledger",
      },
      { status: 403 }
    );
  }

  try {
    const { _id, ledgerName, groupName } = await req.json();

    if (!_id) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Ledger ID is required!",
        },
        { status: 400 }
      );
    }

    if (!ledgerName || !ledgerName.trim()) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Ledger name is required!",
        },
        { status: 400 }
      );
    }

    // Check if ledger exists and belongs to user
    const existingLedger: any = await Ledger.findOne({
      _id,
      userId: authUser._id,
    });

    if (!existingLedger) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Ledger not found!",
        },
        { status: 404 }
      );
    }

    // Check if new name conflicts with another ledger
    if (ledgerName !== existingLedger.ledgerName) {
      const duplicateLedger = await Ledger.findOne({
        ledgerName: ledgerName.trim(),
        userId: authUser._id,
        _id: { $ne: _id },
      });

      if (duplicateLedger) {
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: "Ledger with this name already exists!",
          },
          { status: 400 }
        );
      }
    }

    // Update ledger
    const updateData: any = {
      ledgerName: ledgerName.trim(),
    };

    if (groupName) {
      updateData.groupName = groupName;
    }

    const updatedLedger = await Ledger.findByIdAndUpdate(_id, updateData, {
      new: true,
    });

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Ledger updated successfully",
        result: updatedLedger,
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
        message: "You are not authorized to delete ledger",
      },
      { status: 403 }
    );
  }

  try {
    const searchUrl = new URL(req.url);
    const ledgerId = searchUrl.searchParams.get("id");

    if (!ledgerId) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Ledger ID is required!",
        },
        { status: 400 }
      );
    }

    // Check if ledger exists and belongs to user
    const ledger = await Ledger.findByIdAndDelete({
      _id: ledgerId
    });
    console.log("Ledger to delete:", ledger, ledgerId);
    if (!ledger) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Ledger not found!",
        },
        { status: 404 }
      );
    }


    // Or hard delete - uncomment below
    // await Ledger.findByIdAndDelete(ledgerId);

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Ledger deleted successfully",
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
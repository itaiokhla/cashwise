'use server'

import DataWithDate from "@app/_model/datawithdate.modal";
import { NextRequest, NextResponse } from "next/server";

export  async function PUT(req: NextRequest) {
    console.log("Received PUT request with body:");
  try {
    const { fromDate, toDate, ...rest } = await req.json();
console.log("Received data:", { fromDate, toDate, ...rest });
    if (!fromDate && !toDate) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "fromDate and toDate are required",
        },
        { status: 400 }
      );
    }

    const result = await DataWithDate.findOneAndUpdate(
      { fromDate, toDate },        
      {
        $set: {
          fromDate,
          toDate,
          ...rest,
        },
      },
      {
        new: true,                  // return updated doc
        upsert: true,               // create if not exists
      }
    );

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Data created or updated successfully",
        result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in PUT request:", error);
    return NextResponse.json(
      { type: "ERROR", message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

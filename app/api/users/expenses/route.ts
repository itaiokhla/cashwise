'use server';
import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import Users from "@app/_model/user.model";
import mongoose from "mongoose";
import { DateTime } from 'luxon';
import OfficeExpense from "@app/_model/office.modal";
import TravelExpense from "@app/_model/travel.modal";
import ToPayExpense from "@app/_model/toPay.modal";
import { adminActionMessageAlert } from "@app/_helpers/adminAction.messageAlert";
import { Document } from '@react-pdf/renderer';

// Initialize database connection
(async function initializeDB() {
    await DB();
  })();

  export async function PUT(req: NextRequest) {
    const userHeader = req.headers.get("user");
        const authUser: any = userHeader ? JSON.parse(userHeader) : null;
        if(authUser?.role!=="admin" && authUser?.role!=="manager"){
            return NextResponse.json({
                type: "BAD_REQUEST",
                message: "You are not authorized to create user",
            }, { status: 403 });
        }
    try {
        const body = await req.formData();
        
        // Extract all form values
        const status = body.get('status') as string || '';
        const message = body.get('message') as string || '';
        const formType = body.get('formType');
        const date = body.get('date') as string;
        const userId = body.get('userId') as string;
        const phone = body.get('phone');
        const phoneNumber = phone ? Number(phone) : null;
        const expenseType = body.get('expenseType') as string;
        const expenseId = body.get('expenseId') as string;
        const documentId = body.get('documentId') as string;
        const siteName = body.get('siteName') as string;
        // Validate required fields
        if (!userId || !date || !expenseType || !expenseId) {
            return NextResponse.json(
                { type: 'ERROR', message: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Create dynamic update object
        const updateObj: { [key: string]: any } = {};
        if (status && (status==='approved' || status==='rejected')) updateObj[`${expenseType}.$.status`] = status;
        if (message && message.length>3) updateObj[`${expenseType}.$.adminMessage`] = message;
        if (siteName) updateObj[`${expenseType}.$.siteName`] = siteName;

        // MongoDB update operation
        let result:any;
        if(formType==='Office'){
         result = await OfficeExpense.updateOne(
            {
                createdBy: new mongoose.Types.ObjectId(userId),
                date: date,
                [expenseType]: {
                    $elemMatch: {
                        _id: new mongoose.Types.ObjectId(expenseId)
                    }
                }
            },
            { $set: updateObj }
        );
    }
    if(formType==='ToPay'){
        result = await ToPayExpense.updateOne(
            {
                createdBy: new mongoose.Types.ObjectId(userId),
                date: date,
                [expenseType]: {
                    $elemMatch: {
                        _id: new mongoose.Types.ObjectId(expenseId)
                    }
                }
            },
            { $set: updateObj }
        );
    }
    if(formType==='Travel'){
        result = await TravelExpense.updateOne(
            {
                createdBy: new mongoose.Types.ObjectId(userId),
                date: date,
                [expenseType]: {
                    $elemMatch: {
                        _id: new mongoose.Types.ObjectId(expenseId)
                    }
                }
            },
            { $set: updateObj }
        );
    }
        // Check if document was modified
        if (result.matchedCount === 0) {
            return NextResponse.json(
                { type: 'ERROR', message: 'Expense record not found' },
                { status: 404 }
            );
        }
if (phoneNumber !== null && status) {
    await adminActionMessageAlert(expenseType, status, userId, phoneNumber);
}
        return NextResponse.json(
            { type: 'SUCCESS', message: 'Expense updated successfully' },
            { status: 200 }
        );

    } catch (error) {
        console.error('Error during expense update:', error);
        return NextResponse.json(
            { type: 'ERROR', message: 'Something went wrong!' },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
  try {
    // const userHeader = req.headers.get("user");
    // const authUser: any = userHeader ? JSON.parse(userHeader) : null;

    // if (!authUser) {
    //   return NextResponse.json(
    //     {
    //       type: "UNAUTHORIZED",
    //       message: "You are not authorized, please login!",
    //     },
    //     { status: 403 }
    //   );
    // }

    const { schemaType, documentId, expenseType, filedId, files } = await req.json();

    let Model: any;

    switch (schemaType) {
      case "Office":
        Model = OfficeExpense;
        break;
      case "Travel":
        Model = TravelExpense;
        break;
      case "ToPay":
        Model = ToPayExpense;
        break;
      default:
        return NextResponse.json(
          { type: "BAD_REQUEST", message: "Invalid schemaType!" },
          { status: 400 }
        );
    }

    const document = await Model.findById(documentId);
    if (!document) {
      return NextResponse.json(
        { type: "NOT_FOUND", message: "Expense document not found!" },
        { status: 404 }
      );
    }

    const subFieldArray = document[expenseType];
    if (!Array.isArray(subFieldArray)) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: `Invalid expense type: ${expenseType}` },
        { status: 400 }
      );
    }

    const targetEntry = subFieldArray.find((entry: any) => entry._id?.toString() === filedId);
    if (!targetEntry) {
      return NextResponse.json(
        { type: "NOT_FOUND", message: "Expense entry not found!" },
        { status: 404 }
      );
    }

    if (files?.Location) {
      targetEntry.locationFiles.push(...[].concat(files.Location));
    }

    if (files?.Payment) {
      targetEntry.paymentFiles.push(...[].concat(files.Payment));
    }

    if (files?.Invoice) {
      targetEntry.invoiceFiles.push(...[].concat(files.Invoice));
    }

    await document.save();

    return NextResponse.json({ type: "SUCCESS", message: "Files uploaded successfully!" });
  } catch (error) {
    console.error("Error during expense update:", error);
    return NextResponse.json(
      { type: "ERROR", message: "Something went wrong!" },
      { status: 500 }
    );
  }
}


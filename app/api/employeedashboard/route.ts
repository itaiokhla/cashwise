'use server'
import { NextRequest, NextResponse } from 'next/server';
import DB from '@app/_database/db';
import OfficeExpense from '@app/_model/office.modal';
import TravelExpense from '@app/_model/travel.modal';
import Users from '@app/_model/user.model';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import ToPayExpense from '@app/_model/toPay.modal';

// Initialize database connection
(async function initializeDB() {
    await DB();
})();

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId') || ''; // User id
        const type = searchParams.get('type') || ''; // User type
        const fromDate = searchParams.get('fromDate') || null; // Expense date range start
        const toDate = searchParams.get('toDate') || null; // Expense date range end

        let expenseFilter: any = {};

        if (fromDate && !toDate) {
            expenseFilter.date = { $gte: DateTime.fromISO(fromDate).setZone('Asia/Kolkata').startOf('day').toISODate() };
        }
        if (!fromDate && toDate) {
            expenseFilter.date = { $lte: DateTime.fromISO(toDate).setZone('Asia/Kolkata').startOf('day').toISODate() };
        }
        if (fromDate && toDate) {
            expenseFilter.date = { $gte: DateTime.fromISO(fromDate).setZone('Asia/Kolkata').startOf('day').toISODate(), $lte: DateTime.fromISO(toDate).setZone('Asia/Kolkata').startOf('day').toISODate() };
        }

        let officeExpenses: any = [];
        let travelExpenses: any = [];

        // Fetch office expenses if type is not 'travel'
        if (type !== 'travel') {
            officeExpenses = await OfficeExpense.find(expenseFilter).lean();
        }

        // Fetch travel expenses if type is not 'office'
        if (type !== 'office') {
            travelExpenses = await TravelExpense.find(expenseFilter).lean();
        }

        let totalOffice = 0;
        let totalTravel = 0;

        // Calculate total office expenses
        if (officeExpenses.length > 0) {
            officeExpenses.forEach((expenseItem: any) => {
                Object.keys(expenseItem).forEach((key) => {
                    if (Array.isArray(expenseItem[key])) {
                        expenseItem[key].forEach((expense: any) => {
                            totalOffice += (expense.amount || 0);
                        });
                    }
                });
            });
        }

        // Calculate total travel expenses
        if (travelExpenses.length > 0) {
            travelExpenses.forEach((expenseItem: any) => {
                Object.keys(expenseItem).forEach((key) => {
                    if (Array.isArray(expenseItem[key])) {
                        expenseItem[key].forEach((expense: any) => {
                            totalTravel += (expense.amount || 0);
                        });
                    }
                });
            });
        }

        return NextResponse.json(
            {
                type: 'SUCCESS',
                officeExpenses,
                travelExpenses,
                totalOfficeExpense: totalOffice,
                totalTravelExpense: totalTravel
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error fetching user and expense data:', error);
        return NextResponse.json(
            { type: 'ERROR', message: 'Something went wrong!' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const userId = searchParams.get("userId") || "";
        const schemaName = searchParams.get("schemaName") || "";
        const _id = searchParams.get("_id") || "";
        const field = searchParams.get("field") || "";
        const fieldId = searchParams.get("fieldId") || "";

        if (!userId || !_id || !field) {
            return NextResponse.json(
                { error: "userId, _id, and field are required" },
                { status: 400 }
            );
        }

        // Find the expense document
        let expenseResult: any;
        if (schemaName === 'Office') {
            expenseResult = await OfficeExpense.findOne({ _id: new mongoose.Types.ObjectId(_id) });
        } else if (schemaName === 'Travel') {
            expenseResult = await TravelExpense.findOne({ _id: new mongoose.Types.ObjectId(_id) });
        } else if (schemaName === 'ToPay') {
            expenseResult = await ToPayExpense.findOne({ _id: new mongoose.Types.ObjectId(_id) });
        }

        if (!expenseResult) {
            return NextResponse.json(
                { error: "Expense not found" },
                { status: 404 }
            );
        }

        // Find the specific field entry
        const fieldArray = expenseResult[field];
        if (!fieldArray || !Array.isArray(fieldArray)) {
            return NextResponse.json(
                { error: `Field ${field} not found in expense` },
                { status: 404 }
            );
        }

        const fieldEntry = fieldArray.find((item: any) =>
            item._id.toString() === fieldId
        );

        if (!fieldEntry) {
            return NextResponse.json(
                { error: `Field entry not found or deleted, Please refresh page` },
                { status: 404 }
            );
        }
        console.log("fieldEntry", fieldEntry)
        // Get transaction details from field entry
        const { amount, siteName, todayWork, description, remarks } = fieldEntry;
        const money = amount;
        const reason = `${field.charAt(0).toUpperCase() + field.slice(1)} Expense`;
        console.log("amount remarks, createdAt", amount, remarks, expenseResult?.date)
        // Find the user
        const debitUser: any = await Users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        if (!debitUser) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Find the debit transaction in user's debit array
        let debitTransaction = null;
        let debitEntryIndex = -1;
        let transactionIndex = -1;

        for (let i = 0; i < debitUser.debit.length; i++) {
            const debitEntry = debitUser.debit[i];

            // Check if this debit entry matches the user's name and phone
            if (
                debitEntry.name === debitUser.name &&
                debitEntry.phone === debitUser.phone.toString()
            ) {
                const txnIndex = debitEntry.transactionDetails.findIndex(
                    (txn: any) =>
                        txn.money === money &&
                        txn.reason === reason &&
                        new Date(txn.createdAt).toDateString() === new Date(expenseResult.date).toDateString()
                );
                console.log("txnIndex", txnIndex, money, reason)
                if (txnIndex !== -1) {
                    debitTransaction = debitEntry.transactionDetails[txnIndex];
                    debitEntryIndex = i;
                    transactionIndex = txnIndex;
                    break;
                }
            }
        }

        if (!debitTransaction) {
            return NextResponse.json(
                { error: "Matching debit transaction not found" },
                { status: 404 }
            );
        }





        // Remove the field entry from expense document
        const fieldIndex = fieldArray.findIndex((item: any) =>
            item._id.toString() === fieldId
        );

        if (fieldIndex !== -1) {
            fieldArray.splice(fieldIndex, 1);
            debitUser.debit[debitEntryIndex].transactionDetails.splice(transactionIndex, 1);

            await expenseResult.save();
            await debitUser.save();

        }

        // If no more transactions in this debit entry, remove the entire entry
        if (debitUser.debit[debitEntryIndex].transactionDetails.length === 0) {
            debitUser.debit.splice(debitEntryIndex, 1);


            await debitUser.save();
        }

        return NextResponse.json(
            {
                success: true,
                message: "Transaction deleted successfully",
                deletedTransaction: {
                    money,
                    reason,
                    remarks: remarks || description || '',
                }
            },
            { status: 200 }
        );

    } catch (error) {
        console.log("Error deleting transaction:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
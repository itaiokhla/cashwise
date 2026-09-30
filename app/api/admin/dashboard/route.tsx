'use server';
import DB from "@app/_database/db";
import OfficeExpense from "@app/_model/office.modal";
import TravelExpense from "@app/_model/travel.modal";
import ToPayExpense from "@app/_model/toPay.modal";
import { NextRequest, NextResponse } from "next/server";
import { DateTime } from 'luxon';
import DataWithDate from "@app/_model/datawithdate.modal";

(async function initializeDB() {
    await DB();
})();

function mergeExpenses(expenses: any[]) {
    return Object.values(
        expenses.reduce((acc: any, expense: any) => {
            const userId = expense.user._id.toString();
            if (!acc[userId]) {
                acc[userId] = {
                    user: expense.user,
                    cartage: [],
                    conveyance: [],
                    courier: [],
                    dailyWages: [],
                    food: [],
                    hotel: [],
                    labour: [],
                    loading: [],
                    maintenance: [],
                    other: [],
                    porter: [],
                    purchase: [],
                    rider: [],
                    tea: [],
                    transport: [],
                    createdAt: expense.createdAt,
                    updatedAt: expense.updatedAt,
                    __v: expense.__v
                };
            }
            Object.keys(acc[userId]).forEach((category: string) => {
                if (category !== 'user' && Array.isArray(expense[category])) {
                    acc[userId][category].push(...expense[category]);
                }
            });
            return acc;
        }, {})
    ).slice(0, 20); // Limit to 20 users
}

export async function GET(req: NextRequest) {
    const searchUrl = new URL(req.url);
    const fromDate = searchUrl.searchParams.get('fromDate') || "";
    const toDate = searchUrl.searchParams.get('toDate') || "";
    const name = searchUrl.searchParams.get('name') || '';
    const expenseType = searchUrl.searchParams.get('expenseType') || 'all';
    try {
        const startDate = fromDate ?
            DateTime.fromISO(fromDate).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd') :
            DateTime.now().minus({ weeks: 1 }).toFormat('yyyy-MM-dd');

        const endDate = toDate ?
            DateTime.fromISO(toDate).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd') :
            DateTime.now().toFormat('yyyy-MM-dd');
        const dateResult = await DataWithDate
            .findOne({})
            .sort({ createdAt: -1 });
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const adminFrom = dateResult?.fromDate
            ? new Date(dateResult.fromDate)
            : null;

        const adminTo = dateResult?.toDate
            ? (() => {
                const d = new Date(dateResult.toDate);
                d.setHours(23, 59, 59, 999);
                return d;
            })()
            : null;

        const finalStart = adminFrom && adminFrom > start ? adminFrom : start;
        const finalEnd = adminTo && adminTo < end ? adminTo : end;

        const basePipeline = [
            {
                $addFields: {
                    dateObj: {
                        $dateFromString: {
                            dateString: "$date",
                            format: "%Y-%m-%d",
                        },
                    },
                },
            },
            {
                $match: {
                    dateObj: {
                        $gte: finalStart,
                        $lte: finalEnd,
                    },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $match: {
                    'user.name': { $regex: name, $options: 'i' }
                }
            },
            {
                $project: {
                    'user.password': 0,
                    'user.otp': 0,
                    'user.otpExpiration': 0
                }
            }
        ];

        const [officeExpense, travelExpense, toPayExpense] = await Promise.all([
            (expenseType === 'office' || expenseType === 'all') ?
                OfficeExpense.aggregate(basePipeline) :
                Promise.resolve([]),
            (expenseType === 'travel' || expenseType === 'all') ?
                TravelExpense.aggregate(basePipeline) :
                Promise.resolve([]),
            (expenseType === 'toPay' || expenseType === 'all') ?
                ToPayExpense.aggregate(basePipeline) :
                Promise.resolve([])
        ]);

        const mergedOffice = mergeExpenses(officeExpense);
        const mergedTravel = mergeExpenses(travelExpense);
        const mergedToPay = mergeExpenses(toPayExpense);
        return NextResponse.json(
            {
                type: 'SUCCESS',
                officeExpense: mergedOffice,
                travelExpense: mergedTravel,
                toPayExpense: mergedToPay
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('Error fetching expenses:', error);
        return NextResponse.json(
            { type: 'ERROR', message: 'Something went wrong!' },
            { status: 500 }
        );
    }
}
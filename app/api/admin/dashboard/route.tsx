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

const IST = 'Asia/Kolkata';

/** A date param ("YYYY-MM-DD" or full ISO) or stored Date → "YYYY-MM-DD" in IST, or null. */
function toISTDay(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    const dt = value instanceof Date
        ? DateTime.fromJSDate(value).setZone(IST)
        : DateTime.fromISO(value, { zone: IST });
    return dt.isValid ? dt.toISODate() : null;
}

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
                    contractor: [],
                    createdAt: expense.createdAt,
                    updatedAt: expense.updatedAt,
                    __v: expense.__v
                };
            }
            Object.keys(expense).forEach((key: string) => {
                if (key !== 'user' && Array.isArray(expense[key])) {
                    if (!acc[userId][key]) acc[userId][key] = [];
                    acc[userId][key].push(...expense[key]);
                }
            });
            return acc;
        }, {})
    );
}

export async function GET(req: NextRequest) {
    const searchUrl = new URL(req.url);
    const fromDate = searchUrl.searchParams.get('fromDate') || "";
    const toDate = searchUrl.searchParams.get('toDate') || "";
    const name = searchUrl.searchParams.get('name') || '';
    const expenseType = searchUrl.searchParams.get('expenseType') || 'all';
    try {
        // All range maths is done on "YYYY-MM-DD" calendar days in IST, the
        // same form the expense forms store in `date`.
        const startDay = toISTDay(fromDate) || DateTime.now().setZone(IST).minus({ weeks: 1 }).toISODate()!;
        const endDay = toISTDay(toDate) || DateTime.now().setZone(IST).toISODate()!;

        // Admin-configured visibility window narrows the requested range.
        const dateResult = await DataWithDate
            .findOne({})
            .sort({ createdAt: -1 });
        const adminFromDay = dateResult?.fromDate ? toISTDay(dateResult.fromDate) : null;
        const adminToDay = dateResult?.toDate ? toISTDay(dateResult.toDate) : null;

        const finalStartDay = adminFromDay && adminFromDay > startDay ? adminFromDay : startDay;
        const finalEndDay = adminToDay && adminToDay < endDay ? adminToDay : endDay;

        const basePipeline = [
            {
                $addFields: {
                    // `date` is a "YYYY-MM-DD" string when saved by the app but a
                    // BSON Date in imported records; read both as an IST day.
                    expenseDay: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [{ $type: "$date" }, "date"] },
                                    then: { $dateToString: { date: "$date", format: "%Y-%m-%d", timezone: IST } },
                                },
                                {
                                    // "2026-02-22" or "2026-02-22T…": the leading part is the day.
                                    case: {
                                        $and: [
                                            { $eq: [{ $type: "$date" }, "string"] },
                                            { $regexMatch: { input: "$date", regex: "^\\d{4}-\\d{2}-\\d{2}" } },
                                        ],
                                    },
                                    then: { $substrCP: ["$date", 0, 10] },
                                },
                                {
                                    case: { $eq: [{ $type: "$date" }, "string"] },
                                    then: {
                                        $dateToString: {
                                            date: { $dateFromString: { dateString: "$date", onError: null, onNull: null } },
                                            format: "%Y-%m-%d",
                                            timezone: IST,
                                        },
                                    },
                                },
                            ],
                            default: {
                                $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: IST }
                            },
                        },
                    },
                },
            },
            {
                $match: {
                    expenseDay: {
                        $gte: finalStartDay,
                        $lte: finalEndDay,
                    },
                },
            },
            {
                // `createdBy` is an ObjectId when saved by the app but a plain
                // string in imported records; compare both as strings.
                $lookup: {
                    from: 'users',
                    let: { creatorId: { $toString: '$createdBy' } },
                    pipeline: [
                        { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$creatorId'] } } }
                    ],
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
                    expenseDay: 0,
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
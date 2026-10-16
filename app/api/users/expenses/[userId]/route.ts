export const maxDuration = 60;
import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { toast } from 'react-toastify';
import hash from 'bcrypt';
import Users from "@app/_model/user.model";
import mongoose from "mongoose";
import { DateTime } from 'luxon';
import OfficeExpense from "@app/_model/office.modal";
import TravelExpense from "@app/_model/travel.modal";
import ToPayExpense from "@app/_model/toPay.modal";

// Initialize database connection
(async function initializeDB() {
    await DB();
  })();

  export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const searchUrl = new URL(req.url);
    const fromDate = searchUrl.searchParams.get('fromDate') || "";
    const toDate = searchUrl.searchParams.get('toDate') || "";
    const expenseType= searchUrl.searchParams.get('expenseType') || 'all';
    try {
        const { userId } = await params;
                if (!userId) {
                    return NextResponse.json({ message: 'Please log in to submit the form!' }, { status: 401 });
                }
        const startDate = fromDate ?
            DateTime.fromISO(fromDate).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd') :
            DateTime.now().minus({ years: 1 }).toFormat('yyyy-MM-dd');
        
        const endDate = toDate ?
            DateTime.fromISO(toDate).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd') :
            DateTime.now().toFormat('yyyy-MM-dd');

            const basePipeline = [
                {
                    $addFields: {
                        expenseDay: {
                            $switch: {
                                branches: [
                                    {
                                        case: { $eq: [{ $type: "$date" }, "date"] },
                                        then: { $dateToString: { date: "$date", format: "%Y-%m-%d", timezone: "Asia/Kolkata" } },
                                    },
                                    {
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
                                                timezone: "Asia/Kolkata",
                                            },
                                        },
                                    },
                                ],
                                default: {
                                    $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "Asia/Kolkata" }
                                },
                            },
                        },
                    },
                },
                { 
                    $match: { 
                        expenseDay: { 
                            $gte: startDate, 
                            $lte: endDate 
                        },
                        $expr: {
                            $eq: [{ $toString: '$createdBy' }, userId]
                        }
                    } 
                },
                {
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
            ];
    
            const projection = {
                $project: {
                    expenseDay: 0,
                    'user.password': 0,
                    'user.otp': 0,
                    'user.otpExpiration': 0
                }
            };
    
            const [officeData, travelData, toPayData] = await Promise.all([
                (expenseType === 'office' || expenseType === 'all') ? 
                    OfficeExpense.aggregate([...basePipeline, projection]) : 
                    Promise.resolve([]),
                
                (expenseType === 'travel' || expenseType === 'all') ? 
                    TravelExpense.aggregate([...basePipeline, projection]) : 
                    Promise.resolve([]),
                
                (expenseType === 'toPay' || expenseType === 'all') ? 
                    ToPayExpense.aggregate([...basePipeline, projection]) : 
                    Promise.resolve([])
            ]);
    
            return NextResponse.json(
                { 
                    type: 'SUCCESS', 
                    data: {
                        officeData,
                        travelData,
                        toPayData
                    }
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
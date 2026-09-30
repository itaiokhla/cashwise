'use server';
import DB from "@app/_database/db";
import OfficeExpense from "@app/_model/office.modal";
import TravelExpense from "@app/_model/travel.modal";
import ToPayExpense from "@app/_model/toPay.modal";
import { NextRequest, NextResponse } from "next/server";
import { DateTime } from 'luxon';
import Users from "@app/_model/user.model";

(async function initializeDB() {
    await DB();
})();

export async function GET(req:NextRequest) {
    try{
 const userHeader = req.headers.get("user");
    const authUser: any = userHeader ? JSON.parse(userHeader) : null;

    if (!authUser || authUser.role!=='admin') {
      return NextResponse.json(
        {
          type: "UNAUTHORIZED",
          message: "You are not authorized, please login!",
        },
        { status: 403 }
      );
    }
const usersData = await OfficeExpense.find().populate([{ path: 'createdBy', model: Users, select: '_id name' }])
return NextResponse.json({
    type:"SUCCESS",
    message:"Expenses data",
    usersData
},{status:200})
    }catch(error){
         console.error('Error fetching users:', error);
        return NextResponse.json(
            { type: 'ERROR', message: 'Something went wrong!' }, 
            { status: 500 }
        );
    }
    
}
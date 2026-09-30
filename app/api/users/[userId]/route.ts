export const maxDuration = 60;
import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { toast } from 'react-toastify';
import hash from 'bcrypt';
import Users from "@app/_model/user.model";
import mongoose from "mongoose";

// Initialize database connection
(async function initializeDB() {
    await DB();
  })();

  export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    try {
        const { userId } = await params;
        if (!userId) {
            return NextResponse.json({ message: 'Please log in to submit the form!' }, { status: 401 });
        }
        const result:any = await Users.find({_id: new mongoose.Types.ObjectId(userId)});
        if (!result) {
            return NextResponse.json({
                type: "BAD_REQUEST",
                message: "User not found",
            }, { status: 404 });
        }
        return NextResponse.json({
            type: "SUCCESS",
            message: "User found!",
            result,
         }, { status: 200 });
        } catch (error) {
        return NextResponse.json({
            type: "BAD_REQUEST",
            message: "Something went wrong!"
         }, { status: 500 });
    }
}


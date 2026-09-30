// app/api/admin/expenseLimit/route.ts
'use server';

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import DB from '@app/_database/db';
import Users from '@app/_model/user.model';
import ExpenseLimit from '@app/_model/expenseLimit.modal';
import { DateTime } from 'luxon';
import { otpAlert } from '@app/_helpers/otpAlert';
import { message } from 'antd';

(async () => await DB())();

const LIMIT_FIELDS = [
  'conveyance', 'purchase', 'food', 'tea', 'hotel', 'labour',
  'courier', 'loading', 'porter', 'cartage', 'rider', 'daily_wages',
  'transport', 'maintenance', 'contractor', 'other', 'max_limit', 'status',
] as const;
    const createOtp = () => Math.floor(100000 + Math.random() * 900000);

// ── GET: list expense limits (paginated, optional name/userId filter) ────────
export async function GET(req: NextRequest) {

  try {
    const userHeader = req.headers.get("user");
    const authUser: any = userHeader ? JSON.parse(userHeader) : null;

    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json(
        {
          type: "UNAUTHORIZED",
          message: "You are not authorized, please login!",
        },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const name = url.searchParams.get('name') || '';
    const userId = url.searchParams.get('userId') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return NextResponse.json(
          { type: 'ERROR', message: 'Invalid userId' },
          { status: 400 }
        );
      }
      filter.userId = new mongoose.Types.ObjectId(userId);
    }
    const [result, total] = await Promise.all([
      ExpenseLimit.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'createdBy', model: Users, select: '_id name' }),
      ExpenseLimit.countDocuments(filter),
    ]);

    return NextResponse.json(
      { type: 'SUCCESS', result, total, page, limit },
      { status: 200 }
    );
  } catch (error) {
    console.error('ExpenseLimit GET error:', error);
    return NextResponse.json(
      { type: 'ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}

// ── PUT: create or bulk-update expense limits ────────────────────────────────
export async function PUT(req: NextRequest) {

  try {
    const userHeader = req.headers.get("user");
    const authUser: any = userHeader ? JSON.parse(userHeader) : null;

    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json(
        {
          type: "UNAUTHORIZED",
          message: "You are not authorized, please login!",
        },
        { status: 403 }
      );
    }
    const formData = await req.formData();

    // ── Safe JSON parse helper ────────────────────────────────────────────
    const safeJSON = (val: FormDataEntryValue | null, fallback: any) => {
      if (!val || typeof val !== 'string' || !val.trim()) return fallback;
      try { return JSON.parse(val); } catch { return fallback; }
    };

    const actionType = formData.get('actionType') as string;
    const actionSave = formData.get('actionSave') as string;
    const selectAllChecked = formData.get('selectAllChecked') === 'true';
    const createdByRaw = formData.get('createdBy') as string;
    const data = safeJSON(formData.get('data'), {});
    const usersToChange = safeJSON(formData.get('usersToChange'), []);

    // ── Validate createdBy ────────────────────────────────────────────────
    if (!createdByRaw || !mongoose.Types.ObjectId.isValid(createdByRaw)) {
      return NextResponse.json(
        { type: 'ERROR', message: 'Invalid or missing createdBy' },
        { status: 400 }
      );
    }
    const createdBy = new mongoose.Types.ObjectId(createdByRaw);

    let result: any;

    // ── CREATE new limit ──────────────────────────────────────────────────
    if (actionType === 'new') {
      const name = formData.get('name') as string;
      const userIdRaw = formData.get('userId') as string;

      if (!userIdRaw || !mongoose.Types.ObjectId.isValid(userIdRaw)) {
        return NextResponse.json(
          { type: 'ERROR', message: 'Valid userId are required for actionType "new"' },
          { status: 400 }
        );
      }
      const user: any = await Users.findById(new mongoose.Types.ObjectId(userIdRaw));

      result = await ExpenseLimit.create({
        name: name ? name : user?.name,
        userId: new mongoose.Types.ObjectId(userIdRaw),
        createdBy,
      });

      // ── UPDATE existing limits ────────────────────────────────────────────
    } else {
      // Build the set of fields sent in this request
      const incomingFields: Record<string, any> = { createdBy };
      for (const key of LIMIT_FIELDS) {
        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
          incomingFields[key] = data[key];
        }
      }

      // Determine which docs to update
      let targets: any[];
      if (selectAllChecked) {
        targets = await ExpenseLimit.find({});
      } else {
        if (!Array.isArray(usersToChange) || usersToChange.length === 0) {
          return NextResponse.json(
            { type: 'ERROR', message: 'usersToChange must be a non-empty array when selectAllChecked is false' },
            { status: 400 }
          );
        }

        const ids = (usersToChange as string[])
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        if (ids.length === 0) {
          return NextResponse.json(
            { type: 'ERROR', message: 'No valid ObjectIds in usersToChange' },
            { status: 400 }
          );
        }

        targets = await ExpenseLimit.find({ userId: { $in: ids } });
      }

      if (targets.length === 0) {
        return NextResponse.json(
          { type: 'ERROR', message: 'No matching expense limit records found' },
          { status: 404 }
        );
      }

      const bulkOps = [];

      for (const doc of targets) {
        // Merge: incoming value wins, existing doc value is the fallback
        const finalUpdate: Record<string, any> = {};
        for (const key of LIMIT_FIELDS) {
          finalUpdate[key] =
            incomingFields[key] !== undefined ? incomingFields[key] : doc[key];
        }
        finalUpdate.createdBy = createdBy;

        // Save a rollback snapshot for temporary changes
        if (actionSave === 'temporary') {
          await mongoose.connection
            .collection('rollback_expense_limits')
            .insertOne({
              ...doc.toObject(),
              expireAt: new Date(Date.now() + 30 * 60_000),
            });
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: finalUpdate },
          },
        });
      }

      result = await ExpenseLimit.bulkWrite(bulkOps);
    }

    const success =
      actionType === 'new'
        ? !!result
        : result?.modifiedCount > 0 || result?.nModified > 0;

    return NextResponse.json(
      success
        ? {
          type: 'SUCCESS',
          message:
            'Limit updated successfully!' +
            (actionSave === 'temporary' ? ' Changes will revert in 30 minutes.' : ''),
        }
        : { type: 'ERROR', message: 'Limit update failed!' },
      { status: success ? 201 : 500 }
    );

  } catch (error: any) {
    console.error('ExpenseLimit PUT error:', error);
    return NextResponse.json(
      { type: 'ERROR', message: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}


export async function PATCH(req: NextRequest) {
  try {

    const userHeader = req.headers.get("user");
    const authUser: any = userHeader ? JSON.parse(userHeader) : null;
    if (!authUser) {
      return NextResponse.json(
        {
          type: "UNAUTHORIZED",
          message: "You are not authorized, please login!",
        },
        { status: 403 }
      );
    }
    const otp = createOtp();
    const user: any = await Users.findOne({ _id: new mongoose.Types.ObjectId('67e525f3b5239a00bf276fd3') });
console.log("users",user,createOtp)
    const expirationTime = DateTime.now()
      .setZone("Asia/Kolkata")
      .plus({ minutes: 5 })
      .toJSDate();
    (user as any).otp = otp;
    (user as any).otpExpiration = expirationTime;
    await user.save();
    await otpAlert(Number(createOtp), 9891402128);
    // await otpAlert(otp, 7542918414);
    return NextResponse.json(
      { message: "OTP Send to Phone!" },
      { status: 200 }
    );


  } catch (error: any) {
    console.error('ExpenseLimit PATCH error:', error);
    return NextResponse.json(
      { type: 'ERROR', message: error.message || 'Something went wrong' },
      { status: 500 }
    );

  }
}
export async function POST (req:NextRequest){
  try{
 const userHeader = req.headers.get("user");
    const authUser: any = userHeader ? JSON.parse(userHeader) : null;
    if (!authUser) {
      return NextResponse.json(
        {
          type: "UNAUTHORIZED",
          message: "You are not authorized, please login!",
        },
        { status: 403 }
      );
    }
    const {otp} = await req.json()
    const user: any = await Users.findOne({ _id: new mongoose.Types.ObjectId('67e525f3b5239a00bf276fd3') });
    console.log("users",user,otp)
    if (otp) {
      const currentTime = DateTime.now().setZone("Asia/Kolkata");

      if (
        user.otp !== Number(otp) ||
        currentTime > DateTime.fromJSDate(user.otpExpiration)
      ) {
        return NextResponse.json(
          { message: "Enter Valid OTP!" },
          { status: 404 }
        );
      }
return NextResponse.json(
     { type: 'SUCCESS', message: 'otp verified!' },
      { status: 200 }

    )
    }
    
  }catch(error:any)
  {
   console.error('ExpenseLimit PATCH error:', error);
    return NextResponse.json(
      { type: 'ERROR', message: error.message || 'Something went wrong' },
      { status: 500 }
    );

  }
}
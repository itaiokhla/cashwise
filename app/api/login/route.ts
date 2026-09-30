"use server";
import DB from "@app/_database/db";
import HandleResponse from "@app/_helpers/Handler";
import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import Users from "@app/_model/user.model";
// import otpGenerator  from 'otp-generator'
import { otpAlert } from "@app/_helpers/otpAlert";
import { DateTime } from "luxon";

// Initialize database connection
(async function initializeDB() {
  await DB();
})();
// otp generate function
const createOtp = () => Math.floor(100000 + Math.random() * 900000);

// Registration function
export async function POST(req: Request) {
  try {
    // Parse the request body
    const { email, password, phone, otp } = await req.json();
    let user: any;
    if (phone) {
      user = await Users.findOne(
        { phone },
        { credit: 0, debit: 0, expense: 0 }
      );
    } else {
      user = await Users.findOne(
        { email },
        { credit: 0, debit: 0, expense: 0 }
      );
    }
    // Check if the user exists
    if (!user) {
      return NextResponse.json(
        { message: "Enter Valid Email / Account not exist!" },
        { status: 404 }
      );
    }
    // password checking
    if (password) {
      if (!bcrypt.compareSync(password, user.password)) {
        return NextResponse.json(
          { message: "Enter Valid Password!" },
          { status: 404 }
        );
      }
    }
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
    }
    const payload = {
      _id: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      name: user.name,
      type: user.type,
    };

    //create token and send it to the user
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 24 * 7; // 7 day
    const refreshExp = iat + 60 * 60 * 24 * 7; // 7 day
    const accessToken: any = await new SignJWT({ access: payload })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(exp)
      .setIssuedAt(iat)
      .setNotBefore(iat)
      .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!));
    const refreshToken = await new SignJWT({ refresh: payload })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(refreshExp)
      .setIssuedAt(iat)
      .setNotBefore(iat)
      .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!));
    const cookieStore = await cookies();
    await cookieStore.set("refreshToken", refreshToken, {
      expires: new Date((iat + refreshExp) * 1000),
    });
    await cookieStore.set("accessToken", accessToken, {
      expires: new Date((iat + 7 * 24 * 60 * 60) * 1000),
    });
    await cookieStore.set("role", user?.role, {
      expires: new Date((iat + 7 * 24 * 60 * 60) * 1000),
    });
    cookieStore.set(
      "accessTokenExpire",
      new Date((iat + 24 * 60 * 60) * 1000).toISOString(),
      { expires: new Date((iat + 7 * 24 * 60 * 60) * 1000) }
    );
    // Return a success response
    return NextResponse.json(
      { message: "User Login successfully!", user:payload, accessToken, refreshToken },
      { status: 200 }
    );
  } catch (error: any) {
    // Return an error response
    return NextResponse.json(
      { message: error?.message || "Something Went Wrong!" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { phone } = await req.json();
    const user = await Users.findOne({ phone });

    if (!user) {
      return NextResponse.json(
        { message: "Enter Valid Phone / Account not exist!" },
        { status: 404 }
      );
    }

    const otp = await createOtp();
    const expirationTime = DateTime.now()
      .setZone("Asia/Kolkata")
      .plus({ minutes: 5 })
      .toJSDate();
    (user as any).otp = otp;
    (user as any).otpExpiration = expirationTime;
    await user.save();
    await otpAlert(otp, phone);
    return NextResponse.json(
      { message: "OTP Send to Phone!" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Something Went Wrong!" },
      { status: 500 }
    );
  }
}

'use server'
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import Users from "@/app/_model/user.model";
import mongoose from "mongoose";
import dbConnect from "@/app/_database/db";

// Initialize database connection
(async function initializeDB() {
  await dbConnect();
})();

/**
 * API route handler for refreshing access tokens
 */
export async function POST(req: NextRequest) {
  try {
    // Get the refresh token from request body or cookies
    let refreshToken;
    
    try {
      // Try to get from request body first
      const body = await req.json();
      refreshToken = body.refreshToken;
    } catch (e) {
      // If parsing body fails, try cookies
      refreshToken = req.cookies.get("refreshToken")?.value;
    }
    
    // Validate refresh token exists
    if (!refreshToken) {
      console.log("Refresh token not found in request body or cookies");
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Refresh token is required",
        },
        { status: 400 }
      );
    }
    
    try {
      // Verify the refresh token
      const { payload } = await jwtVerify(
        refreshToken,
        new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
      );
      
      // Check if token has refresh property
      if (!payload.refresh) {
        console.log("Invalid refresh token payload:", payload);
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: "Invalid refresh token",
          },
          { status: 400 }
        );
      }
      
      const userData = payload.refresh as any;
      // Verify the user still exists in the database
      const existingUser = await Users.findById(new mongoose.Types.ObjectId(userData._id));
      if (!existingUser) {
        console.log("user not found")
        return NextResponse.json(
          {
            type: "BAD_REQUEST",
            message: "User not found",
          },
          { status: 400 }
        );
      }
      
      // Create a new access token
      const iat = Math.floor(Date.now() / 1000);
      const exp = iat + (60 * 60 * 1); // 1 hour
      
      const newAccessToken = await new SignJWT({ access: userData })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setExpirationTime(exp)
        .setIssuedAt(iat)
        .setNotBefore(iat)
        .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!));
      
      // Get the return URL if provided
      const returnTo = req.nextUrl.searchParams.get("returnTo") || "/";

      const response = NextResponse.json({
        type: "SUCCESS",
        message: "Token refreshed successfully",
        data: {
          accessToken: newAccessToken,
          returnTo,
        },
      }, { status: 200 });
      
      // Set the new access token as an HTTP-only cookie
      response.cookies.set({
        name: 'accessToken',
        value: newAccessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1, // 1 hour
        path: '/',
      });
      
      return response;
    } catch (error) {
      console.log(error)
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Invalid or expired refresh token",
        },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      {
        type: "INTERNAL_SERVER_ERROR",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
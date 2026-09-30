import DB from "@app/_database/db";
import userModel from "@app/_model/user.model";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await DB(); // This uses the imported DB function
    const { email, newPassword } = await req.json();  // Destructure email and newPassword

    if (!email || !newPassword) {
      return NextResponse.json({ error: "Email or New Password missing" }, { status: 400 });
    }

    // Find user by email
    const user:any = await userModel.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update the user's password
    user.password = newPassword;  // You might want to hash the password before saving

    // Save the updated user record (password will be hashed automatically in the model)
    await user.save();

    return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to change password" }, { status: 500 });
  }
}

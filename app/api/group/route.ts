"use server";
import DB from "@app/_database/db";
import HandleResponse from "@app/_helpers/Handler";
import Group from "@app/_model/group.modal";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await DB();

    const { title } = await req.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Title is required and must be a non-empty string.",
        },
        { status: 400 }
      );
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 50) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Title must be between 3 and 50 characters long.",
        },
        { status: 400 }
      );
    }

    const existingGroup = await Group.findOne({ name: trimmedTitle });
    if (existingGroup) {
      return NextResponse.json(
        {
          type: "CONFLICT",
          message: "A group with this title already exists.",
        },
        { status: 409 }
      );
    }

    const newGroup = new Group({ name: trimmedTitle });
    const result = await newGroup.save();

    if (!result) {
      return NextResponse.json(
        {
          type: "ERROR",
          message: "Failed to create the group. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "New group created successfully.",
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      {
        type: "ERROR",
        message: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user: any = JSON.parse(req.headers.get("user") as string);
    if (!user) {
      return NextResponse.json(
        {
          type: "UNAUTHORIZED",
          message: "User details not found! Please login.",
        },
        { status: 401 }
      );
    }
    const result = await Group.find().populate([
      { path: "members.user", select: "_id name phone", model: "Users" },
    ]);
    if (!result) {
      console.log("result not found");
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Group data not found!",
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Group data found",
        result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      {
        type: "ERROR",
        message: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userHeader = req.headers.get("user");
    if (!userHeader) {
      return NextResponse.json(
        {
          type: "UNAUTHORIZED",
          message: "User details not found! Please login.",
        },
        { status: 401 }
      );
    }

    const user: any = JSON.parse(userHeader);
    const { documentId, role, userId } = await req.json();

    if (!documentId || !role || !userId) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Missing required fields: documentId, role, userId.",
        },
        { status: 400 }
      );
    }
    const document = await Group.findById(
      new mongoose.Types.ObjectId(documentId)
    );
    if (!document) {
      return NextResponse.json(
        {
          type: "BAD_REQUEST",
          message: "Group not found!",
        },
        { status: 400 }
      );
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const existingMemberIndex = document.members.findIndex(
      (item: any) => item.user.toString() === userId.toString()
    );

    if (existingMemberIndex !== -1) {
      if (user?.role === "admin" || user?.role === "manager") {
        document.members.splice(existingMemberIndex, 1);
        await document.save();
        return NextResponse.json(
          {
            type: "SUCCESS",
            message: "Member removed from the group.",
            data: document,
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            type: "ERROR",
            message: "You are not authorized to do this action",
          },
          { status: 500 }
        );
      }
    }

    document.members.push({
      user: new mongoose.Types.ObjectId(user._id),
      role,
    });

    await document.save();

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Member added to the group.",
        data: document,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Group membership update error:", error);
    return NextResponse.json(
      {
        type: "ERROR",
        message: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

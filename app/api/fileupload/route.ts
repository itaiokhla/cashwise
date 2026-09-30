'use server';

import { NextRequest, NextResponse } from "next/server";
import {uploadSingleFile } from "@/app/_lib/uploadHelpers";
import dbConnect from "@app/_database/db";
(async function initializeDB() {
  await dbConnect();
})();
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Get single file and its category from form data
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;

    if (!file || !category) {
      return NextResponse.json(
        { error: "Missing file or category in request" },
        { status: 400 }
      );
    }

    // Upload the single file
    const uploadResult = await uploadSingleFile(file, category);

    if (!uploadResult.url) {
      return NextResponse.json(
        { error: uploadResult.error || "File upload failed" },
        { status: 500 }
      );
    }

    // Return structured response with URL
    return NextResponse.json({
      success: true,
      data: {
        category,
        url: uploadResult.url,
        fileName: file.name,
        size: file.size
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

'use server';
import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { SignJWT } from 'jose';
import { cookies } from 'next/headers'

// Initialize database connection
(async function initializeDB() {
  await DB();
})();

export async function POST(req: Request) {
    const cookieStore = await cookies();
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    cookieStore.delete('accessTokenExpire');

    return new Response('Signed out successfully', { status: 200 });
}

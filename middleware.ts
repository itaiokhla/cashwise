import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/api/login",
  "/api/register",
  "/api/forgot-password",
  "/api/refresh-token",
  "/api/cron/expense-reports",
]);

const PUBLIC_PATH_PATTERNS = [
  /^\/public\/.*/,
  /^\/assets\/.*/,
  /^\/static\/.*/,
  // Public share-report page and its backing API — no login required
  /^\/shared-report\/.*/,
  /^\/api\/reports\/share\/.*/,
];

const ROLE_PATH_MAP = {
  'admin': ['/users/:path*', '/admin/:path*','/site','/account/:*','/travelExpense','/officeExpense','/toPayExpense', '/settings', '/api/settings/:path*'],
  'manager':['/users/:path*', '/admin/:path*','/site','/account/:*','/travelExpense','/officeExpense','/toPayExpense', '/settings', '/api/settings/:path*'],
  'employee': ['/users/expenses/:path*','/account/:path*','/travelExpense','/officeExpense'],
  'toPay': ['/users/expenses/:path*','/account/:path*','/toPayExpense'],
};

/**
 * Middleware function for Next.js authentication
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let token = getTokenFromRequest(request);

  if (!token) {
    return await handleMissingToken(request, pathname);
  }

  try {
    return await processRequestWithToken(request, token, pathname);
  } catch (error: any) {
    if (error.message === "Token expired") {
      console.log("Token expired, attempting to refresh");
      return await handleMissingToken(request, pathname);
    }

    console.error("Authentication error:", error);
    return redirectToLogin(request);
  }
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

async function handleMissingToken(request: NextRequest, pathname: string) {
  const refreshToken = request.cookies.get("refreshToken")?.value;

  if (refreshToken) {
    try {
      const response = await fetch(new URL("/api/refresh-token", request.url).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      const result = await response.json();

      const newAccessToken = result?.data?.accessToken;

      if (result.type === "SUCCESS" && newAccessToken) {
        const userData:any = await verifyToken(newAccessToken);

        if (!hasAccessToPath(userData.role, pathname)) {
          console.log(`User with role ${userData.role} attempted to access restricted path: ${pathname}`);
          return NextResponse.redirect(new URL("/login", request.url));
        }

        const headers = new Headers(request.headers);
        headers.set("user", JSON.stringify(userData));
        headers.set("Authorization", `Bearer ${newAccessToken}`);

        const response = NextResponse.next({ request: { headers } });

        response.cookies.set({
          name: "accessToken",
          value: newAccessToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60,
          path: "/",
        });

        return response;
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
    }
  }

  return redirectToLogin(request);
}

async function processRequestWithToken(request: NextRequest, token: string, pathname: string) {
  const userData: any = await verifyToken(token);

  if (!hasAccessToPath(userData.role, pathname)) {
    console.log(`User with role ${userData.role} attempted to access restricted path: ${pathname}`);
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const headers = new Headers(request.headers);
  headers.set("user", JSON.stringify(userData));
  headers.set("Authorization", `Bearer ${token}`);

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.NEXTAUTH_SECRET!));

  const currentTime = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < currentTime) {
    throw new Error("Token expired");
  }

  const userData = payload.access;
  if (!userData) {
    throw new Error("Invalid token structure");
  }

  return userData;
}

function hasAccessToPath(role: string, pathname: string): boolean {
  if (!Object.values(ROLE_PATH_MAP).some((paths) => paths.some((path) => pathname.startsWith(path)))) {
    return true;
  }

  const allowedPaths = ROLE_PATH_MAP[role as keyof typeof ROLE_PATH_MAP] || [];
  return allowedPaths.some((path) => pathname.startsWith(path));
}

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return request.cookies.get("accessToken")?.value || null;
}

function redirectToLogin(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("accessToken");
  return response;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|fonts|images).*)'],
};

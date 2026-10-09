import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@repo/env";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const webAuthUrl = new URL("/auth", env.NEXT_PUBLIC_WEB_URL);
    return NextResponse.redirect(webAuthUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/ca-workspace/:path*",
    "/billing/:path*",
    "/admin/:path*",
  ],
};

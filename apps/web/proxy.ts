import { NextRequest, NextResponse } from "next/server";
import { env } from "@repo/env";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const appRoutes = [
    "/dashboard",
    "/onboarding",
    "/ca-workspace",
    "/billing",
    "/admin",
  ];

  if (appRoutes.some((route) => pathname.startsWith(route))) {
    const targetUrl = new URL(
      pathname + request.nextUrl.search,
      env.NEXT_PUBLIC_APP_URL,
    );
    return NextResponse.redirect(targetUrl);
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

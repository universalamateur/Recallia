import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookieHeader } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const user = getUserFromCookieHeader(request.headers.get("cookie"));

  if (user) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/timeline/:path*"]
};

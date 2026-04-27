import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getLogoutCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", getLogoutCookieOptions());
  return response;
}

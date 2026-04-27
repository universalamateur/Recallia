import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getSessionCookieValue,
  validateDemoCredentials
} from "@/lib/auth";

async function readCredentials(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  return {
    email: formData.get("email"),
    password: formData.get("password")
  };
}

export async function POST(request: Request) {
  const credentials = await readCredentials(request);
  const user = validateDemoCredentials(credentials);

  if (!user) {
    return NextResponse.json({ error: "Invalid demo credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ user });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    getSessionCookieValue(),
    getSessionCookieOptions()
  );

  return response;
}

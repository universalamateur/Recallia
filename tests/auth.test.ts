import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "../middleware";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { POST as createMemory } from "../src/app/api/memories/route";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieValue
} from "../src/lib/auth";

function timelineRequest(cookie?: string) {
  return new NextRequest("http://localhost/timeline", {
    headers: cookie ? { cookie } : undefined
  });
}

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("demo auth", () => {
  it("rejects an invalid password", async () => {
    const response = await login(
      jsonRequest("/api/auth/login", {
        email: "demo@recallia.local",
        password: "wrong"
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid demo credentials."
    });
  });

  it("redirects unauthenticated timeline access to login", () => {
    const response = middleware(timelineRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Ftimeline"
    );
  });

  it("logs in with the demo credentials and sets an httpOnly sameSite cookie", async () => {
    const form = new FormData();
    form.set("email", "demo@recallia.local");
    form.set("password", "recallia");

    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: form
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        id: "demo-user",
        email: "demo@recallia.local"
      }
    });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("allows timeline access with a valid demo session", () => {
    const response = middleware(
      timelineRequest(`${SESSION_COOKIE_NAME}=${getSessionCookieValue()}`)
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("clears the session on logout and blocks protected access again", async () => {
    const response = await logout(
      new Request("http://localhost/api/auth/logout", { method: "POST" })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");

    const protectedResponse = middleware(timelineRequest(`${SESSION_COOKIE_NAME}=`));
    expect(protectedResponse.status).toBe(307);
  });

  it("rejects unauthenticated memory mutation", async () => {
    const response = await createMemory(
      jsonRequest("/api/memories", { title: "Draft memory" })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required."
    });
  });
});

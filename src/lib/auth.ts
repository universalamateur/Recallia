export const DEMO_USER = {
  id: "demo-user",
  email: "demo@recallia.local",
  password: "recallia"
} as const;

export type DemoUser = {
  id: typeof DEMO_USER.id;
  email: typeof DEMO_USER.email;
};

export const SESSION_COOKIE_NAME = "recallia_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const SESSION_COOKIE_VALUE = "recallia-demo-session";

export function validateDemoCredentials(input: {
  email?: unknown;
  password?: unknown;
}): DemoUser | null {
  if (input.email !== DEMO_USER.email || input.password !== DEMO_USER.password) {
    return null;
  }

  return { id: DEMO_USER.id, email: DEMO_USER.email };
}

export function getSessionCookieValue() {
  return SESSION_COOKIE_VALUE;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}

export function getLogoutCookieOptions() {
  return {
    ...getSessionCookieOptions(),
    maxAge: 0
  };
}

export function getUserFromCookieHeader(cookieHeader: string | null): DemoUser | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = new Map(
    cookieHeader.split(";").map((part) => {
      const [name, ...valueParts] = part.trim().split("=");
      return [name, valueParts.join("=")];
    })
  );

  if (cookies.get(SESSION_COOKIE_NAME) !== SESSION_COOKIE_VALUE) {
    return null;
  }

  return { id: DEMO_USER.id, email: DEMO_USER.email };
}

export function getUserFromRequest(request: Request): DemoUser | null {
  return getUserFromCookieHeader(request.headers.get("cookie"));
}

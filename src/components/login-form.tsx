"use client";

import { LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { safeInternalPath } from "@/lib/routes";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: formData
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Use the local demo credentials to continue.");
      return;
    }

    router.push(safeInternalPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <label>
        Email
        <input
          autoComplete="email"
          defaultValue="demo@recallia.local"
          name="email"
          type="email"
        />
      </label>
      <label>
        Password
        <input
          autoComplete="current-password"
          defaultValue="recallia"
          name="password"
          type="password"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button" disabled={isSubmitting} type="submit">
        <LogIn aria-hidden="true" size={18} />
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

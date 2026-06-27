"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Incorrect email or password.",
  OAuthSignin: "Could not start Microsoft sign-in. Try again.",
  OAuthCallback: "Microsoft sign-in failed. Try again.",
  Default: "Something went wrong. Try again.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const queryError = searchParams.get("error");
  const error = formError ?? (queryError ? ERROR_MESSAGES[queryError] ?? ERROR_MESSAGES.Default : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setFormError(ERROR_MESSAGES.CredentialsSignin);
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-1 items-center justify-center" style={{ background: "var(--color-page-bg)" }}>
      <div
        className="w-full max-w-sm rounded-lg p-8"
        style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)" }}
      >
        <h1 className="text-xl font-semibold mb-1">Capacity Planner</h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
          Sign in to continue
        </p>

        {error && (
          <div
            className="mb-4 rounded px-3 py-2 text-sm"
            style={{ background: "var(--color-rag-red-bg)", color: "var(--color-rag-red-text)" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ border: "1px solid var(--color-border)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ border: "1px solid var(--color-border)" }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2">
          <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-disabled)" }}>
            or
          </span>
          <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
        </div>

        <button
          type="button"
          onClick={() => signIn("azure-ad", { callbackUrl: "/" })}
          className="w-full rounded px-3 py-2 text-sm font-medium"
          style={{ border: "1px solid var(--color-border)" }}
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}

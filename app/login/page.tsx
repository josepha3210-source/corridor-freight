"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CorridorLogo } from "@/components/CorridorLogo";

const URL_ERROR_MESSAGES: Record<string, string> = {
  invite_link_invalid:
    "This invite link didn't work — ask whoever invited you to send a new one.",
  auth_callback_failed:
    "That link didn't work — ask whoever sent it to send a new one.",
};

/**
 * useSearchParams() needs a Suspense boundary around it or the build
 * bails out of static rendering for this page — the actual form (and
 * its use of the ?error= param /auth/callback redirects here with on a
 * failed invite/confirmation link, see §68) lives in LoginForm below.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const urlError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    urlError ? URL_ERROR_MESSAGES[urlError] ?? "Something went wrong." : null
  );

  // Set once a password sign-in succeeds but the account has 2FA
  // enrolled (Settings → Security, §79) — the session exists at this
  // point but only at aal1, and stays that way until the code below is
  // verified. Nothing before this point ever grants dashboard access on
  // its own; a password alone is not enough for a 2FA-enrolled account.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    // aal ("authenticator assurance level") is Supabase's own name for
    // this — aal1 is password-only, aal2 means a second factor has also
    // been verified this session. nextLevel only differs from
    // currentLevel when the account actually has a verified factor
    // enrolled, so this is a no-op password-only login for every
    // account that hasn't turned 2FA on.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];

      setLoading(false);

      if (totpFactor) {
        setMfaFactorId(totpFactor.id);
        return;
      }
      // aal says a step-up is needed but there's no TOTP factor to
      // challenge — shouldn't happen (enrolling and having a verified
      // factor are the same event), but failing loudly here is safer
      // than silently letting the login through at aal1.
      setError("Two-factor verification is required but couldn't be started. Contact support.");
      await supabase.auth.signOut();
      return;
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;

    setError(null);
    setLoading(true);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode,
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (mfaFactorId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <CorridorLogo />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Enter your authentication code
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Open your authenticator app and enter the 6-digit code for this
            account.
          </p>

          <form onSubmit={handleMfaSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="mfaCode"
                className="block text-sm font-medium text-slate-700"
              >
                Authentication code
              </label>
              <input
                id="mfaCode"
                type="text"
                inputMode="numeric"
                required
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <CorridorLogo />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome back. Log in to your company workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have a workspace yet?{" "}
          <Link
            href="/signup"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

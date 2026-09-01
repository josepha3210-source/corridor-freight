"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CorridorLogo } from "@/components/CorridorLogo";

/**
 * Requests a password-reset email. One page for owners, dispatchers, and
 * drivers alike — nothing here is role-specific, same as /login.
 *
 * The confirmation state below shows the same message whether or not
 * `email` actually belongs to an account, and resetPasswordForEmail()
 * itself doesn't error or otherwise signal that back to the caller
 * either — both deliberately, so this page can't be used to find out
 * which emails have accounts.
 *
 * Lands on /auth/callback?next=/auth/set-password — the same landing
 * page and redirectTo shape app/dashboard/settings/invite/route.ts and
 * lib/send-driver-invite.ts already use for invite links. That route
 * currently only actually completes the flow for links shaped as
 * token_hash+type (see the long comment in app/auth/callback/route.ts
 * and ROADMAP.md §69) — the same manual Supabase dashboard step §69
 * documents for "Invite user" also has to be done for the "Reset
 * Password" email template before a real reset email will carry a link
 * this app can complete. The code on this end is ready for that the
 * moment the template is.
 */
export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/set-password`,
      }
    );

    setLoading(false);

    if (resetError) {
      // Genuine failures here are almost always rate-limiting or a
      // malformed address, not "no such account" — Supabase doesn't
      // surface the latter, by design (see the note above).
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <CorridorLogo />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            If an account exists for <strong>{email}</strong>, we sent a
            link to reset your password. It&apos;s valid for a limited
            time — if it expires, just come back to this page and try
            again.
          </p>
          <p className="mt-6 text-center text-sm text-slate-600">
            <Link
              href="/login"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Back to log in
            </Link>
          </p>
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
        <h1 className="text-xl font-semibold text-slate-900">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter your email and we&apos;ll send you a link to reset it.
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
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link
            href="/login"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}

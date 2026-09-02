"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Shared by two flows that both boil down to "set a password on a
 * session that already exists" — an invited teammate's first password,
 * and an existing user finishing a forgot-password reset
 * (app/forgot-password/page.tsx). app/auth/callback/route.ts tags the
 * redirect here with `?flow=recovery` for the latter (see the comment
 * there) so the copy below can say something that actually matches what
 * happened — "you're in, set a password" reads wrong for someone who
 * just reset a password they already had.
 *
 * Now reads a search param, so it needs the same <Suspense> wrapper
 * app/login/page.tsx already carries for the same reason (its own
 * comment explains why: useSearchParams() otherwise fails static
 * generation for the page).
 */
export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const isRecovery = searchParams.get("flow") === "recovery";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace(isRecovery ? "/forgot-password" : "/login");
        return;
      }
      setCheckingSession(false);
    });
  }, [router, supabase, isRecovery]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    // A driver's invite lands them here same as a dispatcher/admin's
    // does — the only thing that decides where they go next is their
    // own role, not which kind of invite they claimed. Same logic
    // applies to a password reset: send them on to wherever their role
    // actually works, not a hardcoded /dashboard.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .single();

    setLoading(false);
    router.push(profile?.role === "driver" ? "/driver" : "/dashboard");
    router.refresh();
  }

  if (checkingSession) {
    return null;
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold text-slate-900">
        {isRecovery ? "Set a new password" : "Set your password"}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {isRecovery
          ? "Choose a new password for your account."
          : "You're in — just set a password so you can log back in next time."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field
          label={isRecovery ? "New password" : "Password"}
          id="password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          required
          minLength={8}
        />
        <Field
          label="Confirm password"
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat your password"
          required
          minLength={8}
        />

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
          {loading
            ? "Saving…"
            : isRecovery
              ? "Update password"
              : "Set password & continue"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-sm font-semibold uppercase tracking-wide text-brand-600">
          Corridor Freight
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

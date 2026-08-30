"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Where an invited teammate lands right after clicking their invite
 * email — the magic link only gets them a session, not a password, and
 * without one they'd have no way to log back in later. Reuses the same
 * "next" query param /auth/callback already supports, so no changes were
 * needed there.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setCheckingSession(false);
    });
  }, [router, supabase]);

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
    // own role, not which kind of invite they claimed.
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
        Set your password
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        You&apos;re in — just set a password so you can log back in next
        time.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field
          label="Password"
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
          {loading ? "Saving…" : "Set password & continue"}
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

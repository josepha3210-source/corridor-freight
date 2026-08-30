"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();

  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // company_name and full_name ride along in the user's metadata. A
    // database trigger (handle_new_user, see supabase/migrations) reads
    // this metadata to create the company row and link this user to it
    // as the owner — see the schema walkthrough for why that lives in
    // the database instead of a second client-side call.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If email confirmation is required, Supabase returns a user but no
    // session yet — send them to check their inbox instead of the app.
    if (data.user && !data.session) {
      setCheckEmail(true);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold text-slate-900">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a confirmation link to <strong>{email}</strong>. Click it
          to activate your account and finish setting up{" "}
          <strong>{companyName}</strong>.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold text-slate-900">
        Create your company workspace
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        You&apos;ll be set up as the owner of this workspace.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field
          label="Company name"
          id="companyName"
          type="text"
          value={companyName}
          onChange={setCompanyName}
          placeholder="Rowan Trucking LLC"
          required
        />
        <Field
          label="Your full name"
          id="fullName"
          type="text"
          value={fullName}
          onChange={setFullName}
          placeholder="Jamie Rowan"
          required
        />
        <Field
          label="Email"
          id="email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          required
        />
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
          {loading ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
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
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
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

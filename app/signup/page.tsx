"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const VALID_PLAN_KEYS = ["starter", "growth", "fleet"] as const;
type PlanKey = (typeof VALID_PLAN_KEYS)[number];

/**
 * useSearchParams() needs a Suspense boundary or the build bails out of
 * static rendering for this page — same fix already applied to
 * app/login/page.tsx. The actual form lives in SignUpForm below.
 */
export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  // Carries the plan picked on the landing page's pricing cards
  // (?plan=starter/growth/fleet) through signup and verification — read
  // once, held in this same component instance for the rest of the flow
  // (see handleVerify for what happens with it). Anything else — no
  // param, or garbage — is treated as "no plan," leaving the new company
  // on the existing free internal trial plan exactly as before this
  // change; this only affects someone who actually came from a pricing
  // card.
  const rawPlan = searchParams.get("plan");
  const [planKey] = useState<PlanKey | null>(
    VALID_PLAN_KEYS.includes(rawPlan as PlanKey) ? (rawPlan as PlanKey) : null
  );

  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Code-based verification step, in place of "click the confirmation
  // link" — signUp() below is unchanged, only what happens after a
  // user-with-no-session result is different now.
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  // True only during the brief window after verification succeeds while
  // this page is asking the checkout route to start a Stripe session —
  // account creation itself is already fully done by this point (see
  // handleVerify's comment on sequencing).
  const [startingCheckout, setStartingCheckout] = useState(false);

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
    // session yet — ask for the code we just emailed them instead of
    // sending them off to click a link.
    if (data.user && !data.session) {
      setAwaitingCode(true);
      return;
    }

    await afterAccountReady();
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    setResendMessage(null);
    setVerifying(true);

    // type: "signup" — this is a brand-new, not-yet-confirmed user
    // verifying the code from their signup email, not an invite/magic-
    // link/recovery flow. Confirmed against the installed
    // @supabase/auth-js's EmailOtpType, which includes 'signup' as a
    // valid literal for exactly this case.
    const { error: verifyOtpError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });

    setVerifying(false);

    if (verifyOtpError) {
      // Deliberately doesn't clear companyName/fullName/email/password —
      // all of it is still sitting in this same component's state, so a
      // wrong or expired code just lets them retry without retyping
      // anything from the first step.
      setVerifyError(verifyOtpError.message);
      return;
    }

    await afterAccountReady();
  }

  /**
   * Runs once a real session exists — either signUp() returned one
   * directly (no confirmation required), or verifyOtp() just minted one.
   * The account and company are fully created and valid the moment this
   * function starts; everything below is a best-effort next step, never
   * a required part of account creation. If a plan was picked and
   * checkout can't be started for any reason (network hiccup, Stripe not
   * configured, the plan not wired up yet), this falls through to the
   * dashboard rather than stranding the user on a blank screen or
   * leaving anything half-created — they land as a fully real owner on
   * the free trial plan and can upgrade anytime from Settings. Closing
   * the tab mid-Stripe-Checkout has the same outcome: nothing about the
   * account depends on checkout completing, so there's no broken
   * intermediate state to get stuck in either way.
   */
  async function afterAccountReady() {
    if (planKey) {
      setStartingCheckout(true);

      const { data: plan } = await supabase
        .from("plans")
        .select("id")
        .eq("key", planKey)
        .single();

      if (plan) {
        const res = await fetch("/dashboard/settings/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id }),
        });
        const body = await res.json().catch(() => ({}));

        if (res.ok && body.url) {
          window.location.href = body.url;
          return;
        }
      }

      setStartingCheckout(false);
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleResend() {
    setVerifyError(null);
    setResendMessage(null);
    setResending(true);

    // Same "signup" type as verifyOtp above — ResendParams' email
    // variant only accepts 'signup' | 'email_change', and this is the
    // signup case.
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setResending(false);

    if (resendError) {
      setVerifyError(resendError.message);
      return;
    }

    setCode("");
    setResendMessage("Code resent — check your email.");
  }

  if (awaitingCode) {
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold text-slate-900">
          Enter your verification code
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a code to <strong>{email}</strong>. Enter it below to
          activate your account and finish setting up{" "}
          <strong>{companyName}</strong>.
        </p>

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <Field
            label="Verification code"
            id="code"
            type="text"
            value={code}
            onChange={setCode}
            placeholder="Enter the code from your email"
            required
            inputMode="numeric"
          />

          {verifyError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {verifyError}
            </p>
          )}
          {resendMessage && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {resendMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={verifying || startingCheckout}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {startingCheckout
              ? "Setting up your subscription…"
              : verifying
                ? "Verifying…"
                : "Verify"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Didn&apos;t get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60"
          >
            {resending ? "Resending…" : "Resend"}
          </button>
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
        {planKey && " You'll set up billing for the plan you picked right after."}
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
  maxLength,
  inputMode,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
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
        maxLength={maxLength}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

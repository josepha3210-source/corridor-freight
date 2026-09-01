"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CorridorLogo } from "@/components/CorridorLogo";

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

  // Onboarding survey (v2 prompt update) — shown after the account (and
  // company) are fully real, before checkout/redirect. Skippable, and
  // never blocks getting into the app: companyId is only fetched to
  // label the one insert this screen ever makes, not to gate anything.
  const [showingSurvey, setShowingSurvey] = useState(false);
  const [surveyCompanyId, setSurveyCompanyId] = useState<string | null>(null);
  const [fleetSize, setFleetSize] = useState("");
  const [currentTool, setCurrentTool] = useState("");
  const [currentToolOther, setCurrentToolOther] = useState("");
  const [headache, setHeadache] = useState("");
  const [headacheOther, setHeadacheOther] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [referralOther, setReferralOther] = useState("");
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

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
   * function starts; the survey and checkout below are both best-effort
   * next steps, never a required part of account creation. companyId is
   * fetched here purely to label the survey's one insert — nothing
   * downstream depends on this lookup succeeding; if it fails for any
   * reason, the survey step just doesn't render (skips straight to
   * checkout/dashboard) rather than blocking on a screen with nowhere
   * to actually submit to.
   */
  async function afterAccountReady() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profile?.company_id) {
        setSurveyCompanyId(profile.company_id);
        setShowingSurvey(true);
        return;
      }
    }

    await proceedToCheckoutOrDashboard();
  }

  /**
   * If a plan was picked and checkout can't be started for any reason
   * (network hiccup, Stripe not configured, the plan not wired up yet),
   * this falls through to the dashboard rather than stranding the user
   * on a blank screen or leaving anything half-created — they land as a
   * fully real owner on the free trial plan and can upgrade anytime
   * from Settings. Closing the tab mid-Stripe-Checkout has the same
   * outcome: nothing about the account depends on checkout completing,
   * so there's no broken intermediate state to get stuck in either way.
   */
  async function proceedToCheckoutOrDashboard() {
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

  async function handleSurveySubmit(e: FormEvent) {
    e.preventDefault();
    if (!fleetSize || !currentTool || !headache || !referralSource) {
      return; // required selects — the form's own `required` attrs cover this in practice
    }

    setSubmittingSurvey(true);
    if (surveyCompanyId) {
      // Best-effort: a failed insert here doesn't block getting into the
      // app — this is product-decision input, not something the account
      // depends on. No error surfaced to the user for the same reason
      // the checkout fallback above doesn't show one.
      await supabase.from("signup_survey_responses").insert({
        company_id: surveyCompanyId,
        fleet_size: fleetSize,
        current_tool: currentTool,
        current_tool_other: currentTool === "another_tms" ? currentToolOther || null : null,
        biggest_headache: headache,
        headache_other: headache === "other" ? headacheOther || null : null,
        referral_source: referralSource,
        referral_other: referralSource === "other" ? referralOther || null : null,
      });
    }
    setSubmittingSurvey(false);
    await proceedToCheckoutOrDashboard();
  }

  async function handleSkipSurvey() {
    await proceedToCheckoutOrDashboard();
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

  if (showingSurvey) {
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold text-slate-900">
          A few quick questions
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Helps us build the right things next — takes 20 seconds.
        </p>

        <form onSubmit={handleSurveySubmit} className="mt-6 space-y-5">
          <SurveyChoice
            label="How many trucks/drivers do you run?"
            value={fleetSize}
            onChange={setFleetSize}
            options={[
              { value: "1-2", label: "1–2" },
              { value: "3-5", label: "3–5" },
              { value: "6-15", label: "6–15" },
              { value: "16-30", label: "16–30" },
              { value: "30+", label: "30+" },
            ]}
          />

          <div>
            <SurveyChoice
              label="What are you using today to manage dispatch and loads?"
              value={currentTool}
              onChange={setCurrentTool}
              options={[
                { value: "spreadsheet", label: "A spreadsheet" },
                { value: "another_tms", label: "Another TMS" },
                { value: "paper", label: "Paper or a notebook" },
                { value: "nothing", label: "Nothing yet" },
              ]}
            />
            {currentTool === "another_tms" && (
              <input
                value={currentToolOther}
                onChange={(e) => setCurrentToolOther(e.target.value)}
                placeholder="Which one?"
                className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
          </div>

          <div>
            <SurveyChoice
              label="What's your biggest headache right now?"
              value={headache}
              onChange={setHeadache}
              options={[
                { value: "driver_pay", label: "Getting drivers paid" },
                { value: "dispatch_organization", label: "Staying organized with dispatch" },
                { value: "compliance", label: "Compliance (IFTA, 2290, inspections)" },
                { value: "other", label: "Something else" },
              ]}
            />
            {headache === "other" && (
              <input
                value={headacheOther}
                onChange={(e) => setHeadacheOther(e.target.value)}
                placeholder="Tell us more"
                className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
          </div>

          <div>
            <SurveyChoice
              label="How'd you hear about Corridor Freight?"
              value={referralSource}
              onChange={setReferralSource}
              options={[
                { value: "search", label: "Search" },
                { value: "referral", label: "Referral" },
                { value: "social_media", label: "Social media" },
                { value: "other", label: "Other" },
              ]}
            />
            {referralSource === "other" && (
              <input
                value={referralOther}
                onChange={(e) => setReferralOther(e.target.value)}
                placeholder="Tell us more"
                className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={
              submittingSurvey ||
              startingCheckout ||
              !fleetSize ||
              !currentTool ||
              !headache ||
              !referralSource
            }
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {startingCheckout
              ? "Setting up your subscription…"
              : submittingSurvey
                ? "Saving…"
                : "Continue"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSkipSurvey}
          disabled={submittingSurvey || startingCheckout}
          className="mt-4 block w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
        >
          Skip for now
        </button>
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
        <div className="mb-6">
          <CorridorLogo />
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

/** A row of selectable pills, not a <select> — four options fits comfortably and reads faster to scan than a dropdown for a one-tap survey question. */
function SurveyChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              value === opt.value
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

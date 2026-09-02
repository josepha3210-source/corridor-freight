"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO_BOOKING_URL } from "@/lib/site-config";

const FLEET_SIZE_OPTIONS = [
  { value: "1-2", label: "1–2 trucks" },
  { value: "3-5", label: "3–5 trucks" },
  { value: "6-15", label: "6–15 trucks" },
  { value: "16-30", label: "16–30 trucks" },
  { value: "30+", label: "30+ trucks" },
];

const CURRENT_TOOL_OPTIONS = [
  { value: "spreadsheet", label: "Spreadsheets" },
  { value: "another_tms", label: "Another dispatch/TMS tool" },
  { value: "paper", label: "Paper / whiteboard" },
  { value: "nothing", label: "Nothing yet" },
];

/**
 * A few real qualifying questions before handing a prospect off to
 * actually book a call — turns "Get a Quote" into a real lead with
 * context, not just a raw Cal.com link with nothing attached to it.
 * Same fleet_size vocabulary as the signup onboarding survey (0025),
 * so answers from a prospect and a brand-new signup are directly
 * comparable later.
 *
 * Insert-only, best-effort: a failed insert doesn't block the visitor
 * from booking a call anyway (same "never let a lead-capture write
 * block the actual goal" reasoning as the IFTA Calculator's email
 * gate) — it still reveals the booking link, just without a saved
 * record of the answers.
 */
export function QuoteRequestForm({ planInterest }: { planInterest: string | null }) {
  const supabase = createClient();

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fleetSize, setFleetSize] = useState("");
  const [currentTool, setCurrentTool] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!companyName.trim() || !email.trim() || !fleetSize || !currentTool) {
      setError("Fill in your company name, email, fleet size, and current tool.");
      return;
    }

    setLoading(true);
    await supabase.from("quote_requests").insert({
      company_name: companyName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      fleet_size: fleetSize,
      current_tool: currentTool,
      plan_interest: planInterest,
      notes: notes.trim() || null,
    });
    // Best-effort — reveal the booking link either way (see comment
    // above); a lost lead record shouldn't cost a visitor their call.
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Thanks, {companyName || "there"} — let&apos;s find a time.
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Book a slot that works for you and we&apos;ll walk through
          {planInterest ? ` the ${planInterest} plan` : " what fits your fleet"}
          {" "}on the call.
        </p>
        <a
          href={DEMO_BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Book a time →
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Company name
          </label>
          <input
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Work email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Phone (optional)
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Fleet size
          </label>
          <select
            required
            value={fleetSize}
            onChange={(e) => setFleetSize(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select…</option>
            {FLEET_SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            What are you running dispatch on today?
          </label>
          <select
            required
            value={currentTool}
            onChange={(e) => setCurrentTool(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select…</option>
            {CURRENT_TOOL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Anything else we should know? (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Submitting…" : "Continue to booking →"}
      </button>
    </form>
  );
}

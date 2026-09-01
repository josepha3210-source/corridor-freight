"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; status: string };

/**
 * TOTP via Supabase Auth's own MFA API — the standard, low-cost way to
 * do this per the Phase 2 spec, not hand-rolled. Enrolling here is only
 * half the feature: app/login/page.tsx's MFA challenge step is the
 * other half, and it's not optional — Supabase requires a session to
 * already be at aal2 before it will let a verified factor be unenrolled
 * ("a user has to have an aal2 authenticator level in order to unenroll
 * a verified factor"), so a build that let someone enroll 2FA but never
 * actually got challenged for it at login would leave them permanently
 * unable to turn it back off — worse than not offering 2FA at all.
 */
export function TwoFactorSection() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  useEffect(() => {
    refreshFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshFactors() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(
      (data?.totp ?? []).map((f) => ({ id: f.id, status: f.status }))
    );
    setLoading(false);
  }

  async function startEnroll() {
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });

    if (enrollError) {
      setError(enrollError.message);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  }

  async function cancelEnroll() {
    // Clean up the unverified factor rather than leaving it dangling —
    // Supabase allows multiple unverified factors to pile up otherwise.
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setEnrolling(false);
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    setError(null);
  }

  async function confirmEnroll(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setError(null);
    setVerifying(true);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    setVerifying(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    setEnrolling(false);
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    await refreshFactors();
  }

  async function disable(id: string) {
    setError(null);
    setDisablingId(id);

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: id,
    });

    setDisablingId(null);

    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }

    await refreshFactors();
  }

  if (loading) {
    return null;
  }

  const verifiedFactor = factors.find((f) => f.status === "verified");

  if (enrolling) {
    return (
      <div className="mt-4 max-w-sm rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Scan this QR code with your authenticator app (Google
          Authenticator, 1Password, Authy, etc.), then enter the 6-digit
          code it generates.
        </p>
        {qrCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrCode} alt="Two-factor QR code" className="mt-3 h-40 w-40" />
        )}
        {secret && (
          <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-500">
            Can&apos;t scan it? Enter this code manually:{" "}
            <span className="font-mono">{secret}</span>
          </p>
        )}

        <form onSubmit={confirmEnroll} className="mt-4 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={verifying}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {verifying ? "Verifying…" : "Verify & enable"}
            </button>
            <button
              type="button"
              onClick={cancelEnroll}
              disabled={verifying}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {verifiedFactor ? (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
            Enabled
          </span>
          <button
            type="button"
            onClick={() => disable(verifiedFactor.id)}
            disabled={disablingId === verifiedFactor.id}
            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
          >
            {disablingId === verifiedFactor.id ? "Disabling…" : "Disable"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEnroll}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Enable two-factor authentication
        </button>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

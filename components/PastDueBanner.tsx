import Link from "next/link";
import { graceDaysRemaining } from "@/lib/past-due";

/**
 * Persistent, not dismissible — a cosmetic status badge (the pre-existing
 * "Past due" pill in lib/billing-format.ts) is easy to never notice.
 * This isn't. Two states, not one generic message: still inside the
 * grace period vs. already write-locked (enforce_payment_write_lock,
 * migration 0014) say different things because they mean different
 * things to the owner reading this.
 */
export function PastDueBanner({ pastDueSince }: { pastDueSince: string }) {
  const daysRemaining = graceDaysRemaining(pastDueSince) ?? 0;
  const isLocked = daysRemaining <= 0;

  return (
    <div className="border-b border-red-800 bg-red-600 px-6 py-3 text-center text-sm font-medium text-white">
      {isLocked ? (
        <>
          Your last payment failed and your grace period has ended — you
          can still view and update existing records, but can&apos;t add
          new loads or drivers until you{" "}
          <Link
            href="/dashboard/settings/billing"
            className="underline underline-offset-2 hover:text-red-100"
          >
            update your payment method
          </Link>
          .
        </>
      ) : (
        <>
          Your last payment failed. You have {daysRemaining} day
          {daysRemaining === 1 ? "" : "s"} left to{" "}
          <Link
            href="/dashboard/settings/billing"
            className="underline underline-offset-2 hover:text-red-100"
          >
            update your payment method
          </Link>{" "}
          before new loads and drivers are blocked.
        </>
      )}
    </div>
  );
}

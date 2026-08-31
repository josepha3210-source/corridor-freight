"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * These preferences are real and saved — but nothing in this app
 * currently sends an email for any of these three events yet, so
 * toggling them off doesn't stop anything that would otherwise happen
 * today. Built ahead of the actual send pipeline (no email provider is
 * configured — same "infrastructure before the account exists" pattern
 * as Stripe in lib/stripe.ts) so the preference is ready the moment
 * that's wired up, rather than needing a second migration later.
 */
export function NotificationPreferencesForm({
  userId,
  notifyLoadDelivered,
  notifyPaymentAwaiting,
  notifyNewTeammate,
}: {
  userId: string;
  notifyLoadDelivered: boolean;
  notifyPaymentAwaiting: boolean;
  notifyNewTeammate: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [loadDelivered, setLoadDelivered] = useState(notifyLoadDelivered);
  const [paymentAwaiting, setPaymentAwaiting] = useState(notifyPaymentAwaiting);
  const [newTeammate, setNewTeammate] = useState(notifyNewTeammate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: {
    notify_load_delivered: boolean;
    notify_payment_awaiting: boolean;
    notify_new_teammate: boolean;
  }) {
    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update(next)
      .eq("id", userId);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-3">
      <Toggle
        label="A load is marked delivered"
        checked={loadDelivered}
        disabled={saving}
        onChange={(checked) => {
          setLoadDelivered(checked);
          save({
            notify_load_delivered: checked,
            notify_payment_awaiting: paymentAwaiting,
            notify_new_teammate: newTeammate,
          });
        }}
      />
      <Toggle
        label="A payment is awaiting"
        checked={paymentAwaiting}
        disabled={saving}
        onChange={(checked) => {
          setPaymentAwaiting(checked);
          save({
            notify_load_delivered: loadDelivered,
            notify_payment_awaiting: checked,
            notify_new_teammate: newTeammate,
          });
        }}
      />
      <Toggle
        label="A new teammate or driver joins"
        checked={newTeammate}
        disabled={saving}
        onChange={(checked) => {
          setNewTeammate(checked);
          save({
            notify_load_delivered: loadDelivered,
            notify_payment_awaiting: paymentAwaiting,
            notify_new_teammate: checked,
          });
        }}
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-300">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700"
      />
    </label>
  );
}

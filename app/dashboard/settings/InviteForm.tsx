"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type InvitableRole = "dispatcher" | "admin" | "driver";

const ROLE_LABEL: Record<InvitableRole, string> = {
  dispatcher: "Dispatcher",
  admin: "Admin",
  driver: "Driver",
};

/**
 * Posts to the invite Route Handler rather than calling Supabase
 * directly — sending an invite needs the service-role key, which never
 * ships to the browser, so this has to go through a server-side route.
 * That route independently re-checks the caller's role and the chosen
 * role against the invites RLS policy (0007); which roles this form
 * *offers* is a UX nicety, not the actual guard.
 *
 * `allowedRoles` comes from the caller's own role (see page.tsx):
 * owner/admin get all three, a dispatcher gets only "driver" — per
 * §66/§67/§68, a dispatcher can invite a driver but not a fellow
 * dispatcher or an admin, so that option is never rendered at all
 * rather than shown disabled.
 *
 * Selecting "driver" also asks for a full name, since a driver invite
 * creates the drivers row itself (there's no existing row to attach to,
 * unlike inviting a driver from the Drivers page) — same insert
 * AddDriverForm does, then the same invite mechanism the Drivers page's
 * "Invite" button uses, both reused server-side (createDriver /
 * sendDriverInvite) rather than duplicated here.
 */
export function InviteForm({ allowedRoles }: { allowedRoles: InvitableRole[] }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<InvitableRole>(allowedRoles[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/dashboard/settings/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        role === "driver" ? { email, role, fullName } : { email, role }
      ),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong sending the invite.");
      return;
    }

    setEmail("");
    setFullName("");
    setRole(allowedRoles[0]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex max-w-lg flex-wrap items-start gap-3">
      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {role === "driver" ? "Invite a driver" : "Invite a teammate"}
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={role === "driver" ? "driver@example.com" : "teammate@example.com"}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {role === "driver" && (
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Full name
          </label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Rivera"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}

      {allowedRoles.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as InvitableRole)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({
  userId,
  fullName: initialFullName,
  email,
  role,
  theme: initialTheme,
}: {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  theme: "light" | "dark";
}) {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(initialFullName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [theme, setTheme] = useState(initialTheme);
  const [themeSaving, setThemeSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", userId);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  async function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    // Apply immediately so the toggle feels instant — router.refresh()
    // below will re-apply the same value once the server round-trips,
    // ThemeSync just does it again redundantly at that point.
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    setThemeSaving(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ theme_preference: next })
      .eq("id", userId);

    setThemeSaving(false);

    if (updateError) {
      // Roll back the optimistic update if it didn't actually save.
      document.documentElement.setAttribute("data-theme", theme);
      setTheme(theme);
      setError(updateError.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-4 max-w-md space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Full name
          </label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Role
          </label>
          <p className="mt-1 text-sm capitalize text-slate-600 dark:text-slate-400">{role}</p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        {saved && !error && <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Dark mode</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Just a preference switch for now — the dark styling itself
            comes in a later pass.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={theme === "dark"}
          onClick={toggleTheme}
          disabled={themeSaving}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
            theme === "dark" ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
              theme === "dark" ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Applies the signed-in user's stored theme preference as a data-theme
 * attribute on <html> — mounted once in the dashboard layout so it runs
 * on every /dashboard/* page load, not just the Settings page where the
 * toggle itself lives. No dark styling is wired to this attribute yet;
 * this just makes the preference real and persistent, ready for a real
 * dark-mode pass later.
 */
export function ThemeSync({ theme }: { theme: "light" | "dark" }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return null;
}

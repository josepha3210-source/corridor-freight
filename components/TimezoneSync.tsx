"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sets a `tz` cookie to the browser's real IANA timezone so server
 * components (lib/timezone.ts) can compute "today" as the viewer's local
 * calendar day instead of the server's. Refreshes once after correcting
 * a missing/stale cookie so a first-ever visit (which had no timezone
 * info yet, and rendered using the UTC fallback) picks up the right
 * value immediately rather than waiting for the next navigation.
 */
export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const existing = document.cookie
      .split("; ")
      .find((row) => row.startsWith("tz="))
      ?.split("=")[1];

    if (existing !== current) {
      document.cookie = `tz=${current}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh();
    }
  }, [router]);

  return null;
}

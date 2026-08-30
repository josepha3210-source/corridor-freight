"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    setLoading(true);
    await supabase.from("invites").delete().eq("id", inviteId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={cancel}
      disabled={loading}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
    >
      {loading ? "Cancelling…" : "Cancel invite"}
    </button>
  );
}

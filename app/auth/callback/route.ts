import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the redirect after a user clicks a link from Supabase Auth —
 * signup confirmation, or an invite (§68). Supports two different link
 * shapes, because they carry the session two structurally different
 * ways:
 *
 * - `token_hash` + `type`: what `admin.inviteUserByEmail()` (and any
 *   email template using `{{ .ConfirmationURL }}`) actually produces.
 *   That link points at Supabase's own hosted `/auth/v1/verify`
 *   endpoint, which verifies the OTP and redirects back here with the
 *   session tokens in the URL *fragment* (`#access_token=...`) — which
 *   a server route can never see, fragments never reach the server. So
 *   this never actually worked via `code` for invite links; it just
 *   never got caught because this project's Supabase instance has
 *   email confirmation on signup effectively unused (signUp returns a
 *   session immediately), so invites were the only real exerciser of
 *   this route. verifyOtp(token_hash, type) is the server-side-safe way
 *   to complete this same verification without ever touching the
 *   fragment — Supabase confirms the token itself is valid and mints a
 *   session here, in this request.
 * - `code`: the PKCE flow (`exchangeCodeForSession`), for anything that
 *   actually goes through a code-exchange redirect (e.g. an OAuth
 *   provider). Kept for that case; not what invite/signup links use
 *   today.
 *
 * NOTE: today's actual invite emails still contain the hash-fragment
 * style link — `redirect_to` gets silently clipped to the bare site
 * origin by this project's Supabase "Redirect URLs" allowlist, and even
 * with that fixed, the default "Invite user" email template uses
 * `{{ .ConfirmationURL }}`, which is the hosted-verify/fragment link,
 * not `token_hash`+`type` as query params. For this branch to actually
 * run for invites, the Supabase dashboard's "Invite user" (and ideally
 * "Confirm signup") email templates need to point at
 * `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type={{ .Type }}&next=...`
 * instead — a manual dashboard change outside what a service-role/anon
 * key can do, see ROADMAP.md §68 for the exact steps. This code is
 * ready for that the moment it's made.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Whichever branch ran, it failed. Don't redirect to /login and let a
  // stale session already in this browser (the owner who sent the
  // invite, or anyone else previously logged in here) mask that: the
  // middleware's "already authenticated → bounce to /dashboard" rule
  // would otherwise turn a broken invite link into "silently land on
  // someone else's dashboard." Sign out first so /login actually renders
  // and the failure is visible.
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/login?error=invite_link_invalid`);
}

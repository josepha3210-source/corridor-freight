import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and keeps the
 * session cookie in sync between the browser and the server. Also acts
 * as the route guard: unauthenticated users get bounced to /login for
 * anything outside the public auth pages.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: don't remove this. It refreshes the session token and
  // must run before any logic that reads the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");
  const isAuthCallback = path.startsWith("/auth");
  const isPublicAsset = path.startsWith("/_next") || path.startsWith("/favicon");
  // Stripe calls this directly, server-to-server — no session cookie
  // exists or ever will for these requests, so without this exclusion
  // every webhook delivery gets redirected to /login before the route
  // handler (which verifies Stripe's own signature) ever runs.
  const isStripeWebhook = path.startsWith("/api/stripe/webhook");
  // The public marketing page for logged-out visitors — app/page.tsx
  // itself decides what to show (landing page vs. redirect to
  // /dashboard) based on whether a session exists, but that logic can
  // only run if middleware lets an unauthenticated request reach it in
  // the first place.
  const isRoot = path === "/";
  // Same reasoning, for the rest of the public marketing site (v2
  // prompt's Phase 6) — Pricing and the IFTA Calculator are logged-out
  // pages by design, not just "/" — and for robots.txt/sitemap.xml,
  // which a search engine crawler requests with no session cookie at
  // all; without this, every crawler hit bounced to /login and neither
  // file was ever actually reachable, silently defeating the whole
  // point of adding them.
  const isPublicMarketingPage = path === "/pricing" || path === "/ifta-calculator";
  const isSeoFile = path === "/robots.txt" || path === "/sitemap.xml";
  // Customer tracking links (Phase 7, v2 prompt update) — a shipper
  // opening this has no Corridor account at all; the token in the URL
  // is its own authorization (public_track_dispatch(), 0031), not a
  // session.
  const isTrackingLink = path.startsWith("/track/");

  if (
    !user &&
    !isAuthPage &&
    !isAuthCallback &&
    !isPublicAsset &&
    !isStripeWebhook &&
    !isRoot &&
    !isPublicMarketingPage &&
    !isSeoFile &&
    !isTrackingLink
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

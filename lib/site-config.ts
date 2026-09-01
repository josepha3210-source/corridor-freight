/**
 * One place for every public-site value that depends on a fact only
 * Joseph can supply — the domain, support contact, founder photo — so
 * dropping in a real one later is a one-line change here, not a find-
 * and-replace across every page that uses it. Matches the same
 * isStripeConfigured()-style "build the real thing, mark what's
 * missing honestly" pattern as everywhere else in this app.
 *
 * SITE_URL: no real domain yet — Joseph's own call (asked directly,
 * answered "stay on vercel.app for now"). Every canonical URL/OG tag/
 * sitemap entry reads from this one constant; set
 * NEXT_PUBLIC_SITE_URL in the environment whenever a real domain is
 * ready and every one of those updates together.
 *
 * SUPPORT_EMAIL: null — no dedicated support inbox exists yet (asked,
 * confirmed). Every place that would show a support contact checks
 * this and omits the row entirely rather than showing a placeholder
 * address real visitors might actually try to use.
 *
 * FOUNDER_PHOTO_URL: null — use the JA initials avatar (asked,
 * confirmed) until a real photo exists. Not a stock photo, not a
 * generated headshot — an honest placeholder, same reasoning as the
 * HVUT stub's own honest-incompleteness pattern.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://corridor-freight.vercel.app";

export const SUPPORT_EMAIL: string | null = null;

export const FOUNDER_NAME = "Joseph Alula";
export const FOUNDER_TITLE = "Founder & Owner";
export const FOUNDER_PHOTO_URL: string | null = null;

export const DEMO_BOOKING_URL = "https://cal.com/joseph-alula-jltwwx/30min";

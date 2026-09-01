import Link from "next/link";
import {
  FOUNDER_NAME,
  FOUNDER_TITLE,
  FOUNDER_PHOTO_URL,
  SUPPORT_EMAIL,
  DEMO_BOOKING_URL,
} from "@/lib/site-config";

const PRODUCT_LINKS = [
  { label: "Dispatch & Loads", href: "/#features" },
  { label: "Driver Management", href: "/#features" },
  { label: "Trucks & Equipment", href: "/#features" },
  { label: "Invoicing & Accounts", href: "/#features" },
  { label: "IFTA Reporting", href: "/ifta-calculator" },
  { label: "Maintenance", href: "/#features" },
  { label: "Document Management", href: "/#features" },
];

/**
 * Shared across every public marketing page. Column layout matches the
 * reference (Company / Product / Support), but content is Corridor's
 * own — Product mirrors the Solutions mega-menu exactly, on purpose, so
 * the two never list different features.
 *
 * No Blog/Case Studies links — there's no real content behind either
 * yet, and a dead link is worse than an absent one. No support email/
 * phone row — none exists yet (confirmed directly rather than assumed);
 * "Contact" instead points at the real Cal.com booking link, an actual
 * working channel, not a placeholder address.
 */
export function MarketingFooter() {
  return (
    <footer id="about" className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Company
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#founder" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                  About
                </a>
              </li>
              <li>
                <a
                  href={DEMO_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Product
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Support
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {SUPPORT_EMAIL && (
                <li>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                    {SUPPORT_EMAIL}
                  </a>
                </li>
              )}
              <li>
                <a
                  href={DEMO_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Contact
                </a>
              </li>
              <li>
                <Link href="/ifta-calculator" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                  IFTA Calculator
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Founder credit — JA initials avatar until a real photo exists (asked, confirmed). */}
        <div id="founder" className="mt-10 flex items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
          {FOUNDER_PHOTO_URL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={FOUNDER_PHOTO_URL}
              alt={FOUNDER_NAME}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-900 text-sm font-semibold text-white dark:bg-brand-800">
              JA
            </div>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-slate-100">{FOUNDER_NAME}</span>
            , {FOUNDER_TITLE}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600">
          © {new Date().getFullYear()} Corridor Freight
        </p>
      </div>
    </footer>
  );
}

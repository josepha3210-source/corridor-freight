import type { Metadata } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/site-config";

// Explicit `icons` metadata rather than relying on Next's app/-directory
// file convention — the real files live in public/brand/, not app/, so
// dropping them in public/ alone would never have been picked up
// automatically. sizes/type are what let a browser pick the right one
// instead of guessing.
//
// metadataBase + Open Graph (v2 prompt's SEO fixes) — every canonical
// URL and OG tag on every page resolves against this one base rather
// than being hardcoded per-page, so swapping in a real domain later
// (lib/site-config.ts) is a one-line change, not a find-and-replace.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Corridor Freight",
    template: "%s · Corridor Freight",
  },
  description: "Dispatch and payroll for small trucking companies.",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "Corridor Freight",
    description: "Dispatch and payroll for small trucking companies.",
    url: SITE_URL,
    siteName: "Corridor Freight",
    images: [{ url: "/brand/icon.png", width: 512, height: 512 }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Corridor Freight",
    description: "Dispatch and payroll for small trucking companies.",
    images: ["/brand/icon.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

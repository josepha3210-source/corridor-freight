import type { Metadata } from "next";
import "./globals.css";

// Explicit `icons` metadata rather than relying on Next's app/-directory
// file convention — the real files live in public/brand/, not app/, so
// dropping them in public/ alone would never have been picked up
// automatically. sizes/type are what let a browser pick the right one
// instead of guessing.
export const metadata: Metadata = {
  title: "Corridor Freight",
  description: "Dispatch and payroll for small trucking companies.",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" }],
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

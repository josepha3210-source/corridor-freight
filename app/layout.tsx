import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corridor Freight",
  description: "Dispatch and payroll for small trucking companies.",
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

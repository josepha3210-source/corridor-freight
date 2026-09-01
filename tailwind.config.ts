import type { Config } from "tailwindcss";

const config: Config = {
  // Selector-based (not 'media') because theme is a stored per-user
  // preference (profiles.theme_preference), not the OS setting — Settings
  // > My Profile writes it, and ThemeSync applies it as a data-theme
  // attribute on <html> on every /dashboard/* page load. This ties the
  // dark: variant to that same attribute instead of prefers-color-scheme.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          // Real dark navy, not just a darker version of 700 — these are
          // for surfaces (sidebar background, dashboard dark-mode
          // panels, stat-card accents), not for text-on-light or
          // light-mode component backgrounds, which stay on 50–700.
          // Deliberately not a uniform darkening of the whole scale:
          // mixing surface-navy in below 700 would wreck light-mode
          // contrast for anything still using 500/600/700 as an accent
          // color against a white background.
          800: "#1e3a5f",
          900: "#152a44",
          950: "#0b1729",
        },
      },
    },
  },
  plugins: [],
};

export default config;

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
        },
      },
    },
  },
  plugins: [],
};

export default config;

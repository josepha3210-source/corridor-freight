/**
 * The real wordmark, swapped by theme — same `data-theme` selector every
 * other themed thing in this app uses (see tailwind.config.ts's
 * `darkMode` comment), not a second detection mechanism. Two <img>s
 * rather than one src swapped in JS: this needs to work correctly on
 * first paint from the server, before any client JS has a chance to
 * read the theme, and CSS `dark:hidden`/`hidden dark:block` already
 * handles that with zero flash.
 */
export function CorridorLogo({ className = "h-6" }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-light.png"
        alt="Corridor Freight"
        className={`block w-auto dark:hidden ${className}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-dark.png"
        alt="Corridor Freight"
        className={`hidden w-auto dark:block ${className}`}
      />
    </>
  );
}

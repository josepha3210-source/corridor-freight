/**
 * Shared between AddIncidentForm.tsx ("use client") and the driver
 * scorecard page (a Server Component) — deliberately its own plain
 * module, not exported from the client form itself. A "use client"
 * file's exports are all treated as client component references by
 * the RSC bundler; a Server Component importing a plain value (not a
 * component) from one fails at runtime with "Could not find the
 * module ... in the React Client Manifest" even though it type-checks
 * fine. Caught live via the console/dev-server error when first
 * loading the scorecard page after adding an incident.
 */
export const CATEGORY_LABEL: Record<string, string> = {
  safety: "Safety",
  compliance: "Compliance",
  conduct: "Conduct",
  other: "Other",
};

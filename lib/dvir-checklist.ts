/**
 * The FMCSA-standard driver vehicle inspection items (49 CFR 396.11) —
 * fixed list, not user-editable, which is why it's plain data here and
 * a jsonb array on the row (0021) rather than a child table. Keep this
 * in sync by hand with any future checklist changes; there's no shared
 * source of truth with the database for it.
 */
export const DVIR_CHECKLIST_ITEMS: string[] = [
  "Brakes (service, parking, trailer)",
  "Coupling devices",
  "Emergency equipment (fire extinguisher, triangles, fuses)",
  "Exhaust system",
  "Fuel system",
  "Horn",
  "Lights (head, tail, turn signal, clearance) and reflectors",
  "Mirrors",
  "Oil pressure",
  "Steering mechanism",
  "Tires",
  "Wheels and rims",
  "Windshield wipers",
  "Frame and body",
];

export type ChecklistItem = { item: string; defect: boolean };

export function blankChecklist(): ChecklistItem[] {
  return DVIR_CHECKLIST_ITEMS.map((item) => ({ item, defect: false }));
}

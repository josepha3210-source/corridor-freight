/**
 * Example per-gallon fuel tax rates for the public IFTA Calculator
 * (marketing site only — has nothing to do with the real in-app IFTA
 * report at /dashboard/ifta, which never asserts a tax rate at all,
 * only gallons purchased per jurisdiction).
 *
 * These are NOT verified current rates. IFTA rates are set per
 * jurisdiction and change every quarter; a real, complete, current
 * table for all 58 jurisdictions couldn't be confirmed against a live,
 * authoritative source while building this (the same accuracy problem
 * hit with the HVUT tax table) — a search surfaced a handful of real
 * Q2 2026 figures (California, Pennsylvania, Illinois) but nothing
 * complete or independently verifiable enough to present as
 * authoritative. Rather than either fabricate a full table or ship a
 * calculator with no numbers in it at all, this ships clearly-labeled
 * example rates for the jurisdictions carriers actually ask about
 * most, every one of them editable in the calculator UI before
 * computing anything — the visitor's own current rate, not this
 * table's guess, is what actually gets used once they change it.
 * Never presented as "current" anywhere in the UI, only "example."
 */
export const IFTA_EXAMPLE_RATES: Record<string, number> = {
  CA: 1.09,
  PA: 0.741,
  IL: 0.607,
  IN: 0.55,
  OH: 0.47,
  NY: 0.446,
  TX: 0.2,
  FL: 0.3963,
  GA: 0.3473,
  NC: 0.4045,
  TN: 0.27,
  MO: 0.2245,
  KY: 0.246,
  WI: 0.329,
  MI: 0.294,
};

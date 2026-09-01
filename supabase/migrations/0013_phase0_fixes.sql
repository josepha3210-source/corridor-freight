-- Corridor Freight — Phase 0 bug fixes (v2 transformation prompt)
-- One real schema change: a server-side driver name check. Everything
-- else in Phase 0 (stale signature error, button spacing, placeholder
-- copy, load-time validation, the Notifications/Billing UI fixes) is
-- app-code only, no migration needed. Email confirmation being off is a
-- Supabase Auth dashboard setting (Authentication → Providers → Email →
-- "Confirm email"), not something this file or any service-role call
-- can flip.

-- ============================================================================
-- driver full_name: require a real first + last name, not just any
-- non-empty string
-- ----------------------------------------------------------------------------
-- A driver named "m" was accepted and propagated everywhere (load
-- table, payroll, dashboard) — client-side validation on AddDriverForm
-- alone isn't a real guard, same reasoning this app already applies
-- everywhere else (see enforce_driver_limit in 0009 for why a client-
-- side-only check was rejected there too). Requires at least two
-- whitespace-separated tokens, each at least 2 characters — "Al Rivera"
-- passes, "m" and "M " don't. Known, accepted limitation: this rejects a
-- genuinely single-name person — not attempting anything more clever
-- than what was actually asked for here.
--
-- NOT VALID deliberately: checked live before writing this — two
-- existing driver rows in this database are literally named "m" (this
-- is almost certainly the exact row the audit found). A plain ADD
-- CONSTRAINT validates every existing row and would fail this migration
-- outright rather than fix anything. NOT VALID enforces the check on
-- every INSERT and UPDATE from this point forward (closing the actual
-- bug) without touching those two rows or guessing what their real
-- names should be — that's a correction for whoever owns that data to
-- make, not something to silently invent here. Postgres still uses this
-- constraint for the query planner and treats it as fully enforced
-- going forward; VALIDATE CONSTRAINT can retroactively check the old
-- rows later, once someone's ready to fix them.
-- ============================================================================

alter table public.drivers
  add constraint drivers_full_name_has_first_and_last
    check (full_name ~ '^\S{2,}(\s+\S{2,})+$') not valid;

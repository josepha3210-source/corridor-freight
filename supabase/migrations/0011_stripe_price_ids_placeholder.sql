-- Corridor Freight — wire up Stripe price IDs
-- Sets the real Stripe Price IDs (created in the Stripe Dashboard) on the
-- three paid plans so the checkout route's "does this plan have a
-- stripe_price_id" gate (app/dashboard/settings/billing/checkout/
-- route.ts) has something real to read. Trial stays free/unpurchasable,
-- so its stripe_price_id is untouched (still null).
--
-- Already run against Supabase directly (via the SQL editor) on
-- 2026-08-31 — this file exists to keep the repo's record of schema
-- changes in sync with what's actually live. Updates existing rows by
-- `key`, not a fresh insert — 0009 already created these plans.

update public.plans set stripe_price_id = 'price_1UAXlsGeijmMDT2NpNP7wSAD' where key = 'starter';
update public.plans set stripe_price_id = 'price_1UAXmcGeijmMDT2Nx2cQ4nRz' where key = 'growth';
update public.plans set stripe_price_id = 'price_1UAXnXGeijmMDT2NHBELu1Yu' where key = 'fleet';

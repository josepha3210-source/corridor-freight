-- Corridor Freight — v2 prompt update: public Pricing page
-- `plans` (0009) only ever granted select to authenticated users —
-- fine while the only place that read it was the in-app Billing page
-- and the signup flow's plan lookup, both always logged in by the time
-- they run. The new public /pricing page needs to read plan names,
-- driver limits, descriptions, and feature lists for a logged-out
-- visitor — none of that is sensitive (it's the same information
-- meant to be shown publicly), so this adds an anon-select policy
-- alongside the existing one rather than replacing it.
--
-- Still doesn't expose monthly_price_cents anywhere on the public
-- site — that's an app-level choice (the page just doesn't render that
-- column for paid tiers, routing to a quote request instead), not an
-- RLS one; the column itself has to stay readable since Trial's price
-- (0, "Free") does get shown, and the in-app Billing page still needs
-- every plan's real price for a logged-in owner about to pay.
create policy "anyone can view plans"
  on public.plans for select
  to anon
  using (true);

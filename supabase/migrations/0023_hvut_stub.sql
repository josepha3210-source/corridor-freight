-- Corridor Freight — Phase 5d: HVUT Form 2290 — stub, following the
-- same honest-placeholder shape as 0011's Stripe price IDs: a real
-- table with real columns for what a filing actually needs, not a
-- ComingSoon screen — but two things this migration deliberately does
-- NOT do:
--
-- 1. No e-filing. Actually transmitting a 2290 to the IRS requires an
--    authorized IRS e-file provider integration — a real business
--    decision (which provider, what it costs) not made here, same as
--    the HVUT placeholder's own copy always said.
-- 2. No auto-computed tax amount. Form 2290's Tax Computation Table
--    (categories A-V) is a real fixed federal schedule, but this was
--    built without being able to confirm the exact current-year dollar
--    figures against a live source — presenting a possibly-wrong tax
--    number as authoritative would be worse than not computing one at
--    all. `tax_amount` is entered by hand, sourced from the current
--    Form 2290 instructions or a preparer/e-file provider, not derived
--    by this app.
--
-- weight_category is real, though — A through V is the actual IRS
-- structure (A = 55,000 lbs, each letter +1,000 lbs, V = 75,000+).

create table public.hvut_filings (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  truck_id              uuid not null references public.trucks (id) on delete cascade,

  tax_year              integer not null,
  weight_category       text not null check (weight_category in (
    'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V'
  )),
  first_used_month      integer not null check (first_used_month between 1 and 12),
  tax_amount            numeric(10, 2) check (tax_amount is null or tax_amount >= 0),

  filing_status         text not null default 'not_filed' check (filing_status in ('not_filed', 'filed', 'paid')),
  filed_at              date,
  schedule_1_received   boolean not null default false,
  notes                 text,

  created_at            timestamptz not null default now()
);

create index hvut_filings_company_id_idx on public.hvut_filings (company_id);
create index hvut_filings_truck_id_idx   on public.hvut_filings (truck_id);

alter table public.hvut_filings enable row level security;

create policy "select own company hvut filings"
  on public.hvut_filings for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company hvut filings"
  on public.hvut_filings for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company hvut filings"
  on public.hvut_filings for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

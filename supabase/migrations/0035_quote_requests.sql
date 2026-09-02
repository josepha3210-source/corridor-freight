-- Corridor Freight — marketing site: qualified quote requests
--
-- The public Pricing page's paid-tier CTA ("Get a Quote" / "Talk to
-- us") used to link straight out to the Cal.com booking page with no
-- qualification at all. This adds a short form in between (/quote) —
-- a few real qualifying questions (company, fleet size, current tool,
-- email) captured before handing the visitor off to actually book a
-- time — so a lead is a real lead (with context Joseph can review
-- before the call) rather than just a raw booking with no information
-- attached to it.
--
-- Same insert-only, anon-role, no-select-from-the-client shape as
-- ifta_calculator_leads (0030): a lead is written once and reviewed
-- directly via database access, not read back by the page itself.

create table public.quote_requests (
  id             uuid primary key default gen_random_uuid(),

  company_name   text not null,
  email          text not null,
  phone          text,

  -- Same vocabulary as signup_survey_responses (0025)'s fleet_size,
  -- so answers from a prospect and a brand-new signup are directly
  -- comparable later.
  fleet_size     text not null check (fleet_size in ('1-2', '3-5', '6-15', '16-30', '30+')),
  current_tool   text not null check (current_tool in ('spreadsheet', 'another_tms', 'paper', 'nothing')),

  -- Which plan card the visitor actually clicked through from
  -- (starter/growth/fleet/custom) — not a foreign key, since a lead
  -- isn't tied to any company/plan row yet and the plan a prospect
  -- expresses interest in shouldn't break if plan keys ever change.
  plan_interest  text,
  notes          text,

  created_at     timestamptz not null default now()
);

create index quote_requests_created_at_idx on public.quote_requests (created_at);

alter table public.quote_requests enable row level security;

create policy "anyone can submit a quote request"
  on public.quote_requests for insert
  to anon
  with check (true);

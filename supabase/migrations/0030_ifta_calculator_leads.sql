-- Corridor Freight — v2 prompt update: public IFTA Calculator lead capture
-- The public IFTA Calculator (Phase 6) gates its computed estimate
-- behind an email address — this is what actually makes it "a real
-- marketing lead source" rather than just a calculator. Insert-only
-- from a logged-out visitor (anon role, no auth at all on this public
-- page), no select/update/delete from the client — a lead is written
-- once and read back only by whoever has real database access, same
-- write-only-from-the-client shape as nothing else quite matches in
-- this app, but the closest precedent is signup_survey_responses
-- (0025)'s own insert-only, no-edit-later reasoning.

create table public.ifta_calculator_leads (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  base_jurisdiction text,
  quarter_label     text,
  fuel_type         text,
  total_miles       numeric,
  total_gallons     numeric,
  estimated_total   numeric,
  created_at        timestamptz not null default now()
);

create index ifta_calculator_leads_created_at_idx on public.ifta_calculator_leads (created_at);

alter table public.ifta_calculator_leads enable row level security;

create policy "anyone can submit an ifta calculator lead"
  on public.ifta_calculator_leads for insert
  to anon
  with check (true);

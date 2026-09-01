-- Corridor Freight — Phase 0 (v2 prompt update): signup onboarding survey
-- One-time snapshot of who just signed up and why — real product-
-- decision input (which plan tiers to prioritize, what module to build
-- next) once there's enough of it, not a UI nicety. Insert-only: no
-- update or delete policy, since nobody edits their own answer to this
-- later, it's a point-in-time record of what was true at signup.

create table public.signup_survey_responses (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,

  fleet_size            text not null check (fleet_size in ('1-2', '3-5', '6-15', '16-30', '30+')),
  current_tool          text not null check (current_tool in ('spreadsheet', 'another_tms', 'paper', 'nothing')),
  current_tool_other    text, -- which TMS, only meaningful when current_tool = 'another_tms'

  biggest_headache      text not null check (biggest_headache in ('driver_pay', 'dispatch_organization', 'compliance', 'other')),
  headache_other         text, -- only meaningful when biggest_headache = 'other'

  referral_source       text not null check (referral_source in ('search', 'referral', 'social_media', 'other')),
  referral_other        text, -- only meaningful when referral_source = 'other'

  created_at            timestamptz not null default now()
);

create index signup_survey_responses_company_id_idx on public.signup_survey_responses (company_id);

alter table public.signup_survey_responses enable row level security;

-- Insert-only, and only the new owner writing their own company's one
-- response — company_id has to match the caller's own company (set by
-- handle_new_user() by the time this ever runs, since the survey only
-- shows after the account is fully created).
create policy "insert own company signup survey response"
  on public.signup_survey_responses for insert
  with check (company_id = public.current_company_id());

-- Owner/admin can look back at their own company's answer (mostly
-- useful for Joseph reviewing aggregate answers directly via SQL, but
-- no reason to hide it from the company that gave it either).
create policy "select own company signup survey response"
  on public.signup_survey_responses for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'admin'));

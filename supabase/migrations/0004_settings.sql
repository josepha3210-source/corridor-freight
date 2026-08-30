-- Corridor Freight — Settings
-- Three independent additions: company contact fields, a per-user theme
-- preference, and the invites mechanism that lets an owner bring in one
-- teammate safely.

-- ============================================================================
-- company contact fields
-- ============================================================================

alter table public.companies
  add column phone   text,
  add column address text;

-- ============================================================================
-- per-user theme preference
-- ============================================================================

alter table public.profiles
  add column theme_preference text not null default 'light'
    check (theme_preference in ('light', 'dark'));

-- ============================================================================
-- helper: current_user_role()
-- ----------------------------------------------------------------------------
-- Same shape as current_company_id() — needed because the invites RLS
-- policies below have to check "is this caller an owner", not just "is
-- this caller in the same company".
-- ============================================================================

create function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- invites
-- ----------------------------------------------------------------------------
-- Deliberately NOT "trust a company_id the client hands us at signup" —
-- that would let anyone signing up through the public /signup form pass
-- an arbitrary company_id in their signup metadata and join a stranger's
-- tenant as a dispatcher. Instead, an owner writes a row here (RLS-gated
-- to their own company, and only while they hold the 'owner' role), and
-- handle_new_user() below only ever joins a new user to an existing
-- company by matching their email against a pending invite it looked up
-- itself — never by trusting anything the client submitted.
-- ============================================================================

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  email       text not null,
  invited_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

create index invites_company_id_idx on public.invites (company_id);

-- One outstanding invite per (company, email) at a time — a second
-- invite to the same address just fails until the first is accepted,
-- rather than creating duplicate pending rows.
create unique index invites_company_email_pending_unique
  on public.invites (company_id, lower(email))
  where accepted_at is null;

alter table public.invites enable row level security;

create policy "owners can view own company invites"
  on public.invites for select
  using (company_id = public.current_company_id() and public.current_user_role() = 'owner');

create policy "owners can create invites for own company"
  on public.invites for insert
  with check (company_id = public.current_company_id() and public.current_user_role() = 'owner');

create policy "owners can delete own company invites"
  on public.invites for delete
  using (company_id = public.current_company_id() and public.current_user_role() = 'owner');

-- No update policy for clients — handle_new_user() marks an invite
-- accepted as the trigger's definer, same pattern as everywhere else it
-- needs to write across a table it doesn't otherwise have client-side
-- access to modify. Delete is for cancelling a still-pending invite (or
-- rolling one back if the invite email fails to send), never for erasing
-- an already-accepted one — nothing in the app ever deletes those.

-- ============================================================================
-- handle_new_user(): now invite-aware
-- ----------------------------------------------------------------------------
-- Replaces the Phase 1 version. Looks for a pending invite matching the
-- new user's email — set by Supabase itself, not client-suppliable data
-- — and if found, joins that company as 'dispatcher' (never anything
-- else, regardless of what any metadata claims) and marks the invite
-- used. Otherwise, unchanged: creates a new company and becomes its
-- owner, exactly as it did before invites existed.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_invite public.invites;
  new_company_id uuid;
begin
  select * into matched_invite
    from public.invites
    where lower(email) = lower(new.email) and accepted_at is null
    order by created_at desc
    limit 1;

  if matched_invite.id is not null then
    insert into public.profiles (id, company_id, full_name, role)
    values (
      new.id,
      matched_invite.company_id,
      new.raw_user_meta_data ->> 'full_name',
      'dispatcher'
    );

    update public.invites set accepted_at = now() where id = matched_invite.id;
  else
    insert into public.companies (name)
    values (coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company'))
    returning id into new_company_id;

    insert into public.profiles (id, company_id, full_name, role)
    values (
      new.id,
      new_company_id,
      new.raw_user_meta_data ->> 'full_name',
      'owner'
    );
  end if;

  return new;
end;
$$;

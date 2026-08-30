-- Corridor Freight — Phase 2 migration
-- Adds a human-friendly, per-company load number, and closes off hard
-- deletion of loads at the database level (not just the UI) — a load's
-- only "removal" path is the status lifecycle ending at 'cancelled'.

-- ============================================================================
-- load_number: auto-generated per company, editable after the fact
-- ============================================================================

-- Per-company counter. Lives on companies (not a global sequence) so each
-- tenant's numbers start at 1 and stay dense, instead of jumping around
-- based on unrelated tenants' activity.
alter table public.companies
  add column next_load_number integer not null default 1;

alter table public.loads
  add column load_number text;

-- Runs before insert so the NOT NULL constraint (added below) is always
-- satisfied by the time Postgres checks it. SECURITY DEFINER because the
-- inserting client's own session has no reason to be granted UPDATE on
-- companies just for this — same reasoning as handle_new_user().
create function public.set_load_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_number integer;
begin
  if new.load_number is null or btrim(new.load_number) = '' then
    -- The UPDATE takes a row lock on this company for the duration of the
    -- transaction, so two loads created at the same instant for the same
    -- company still get distinct numbers instead of racing.
    update public.companies
      set next_load_number = next_load_number + 1
      where id = new.company_id
      returning next_load_number - 1 into assigned_number;

    new.load_number := 'L-' || lpad(assigned_number::text, 4, '0');
  end if;

  return new;
end;
$$;

create trigger set_load_number_before_insert
  before insert on public.loads
  for each row execute function public.set_load_number();

alter table public.loads
  alter column load_number set not null;

-- Editable afterward, but never a duplicate within the same company.
alter table public.loads
  add constraint loads_company_load_number_unique unique (company_id, load_number);

-- ============================================================================
-- lock down hard deletion of loads
-- ----------------------------------------------------------------------------
-- RLS defaults to deny, so removing this policy (rather than leaving it
-- and just not building a delete button) means no client — including one
-- calling the Supabase API directly — can delete a load. A load's only
-- "removal" is the status lifecycle ending at 'cancelled'.
-- ============================================================================

drop policy "delete own company loads" on public.loads;

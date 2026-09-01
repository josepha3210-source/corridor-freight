-- Corridor Freight — Phase 4b: Settlement methods
-- Replaces flat "mark paid" (one manually-typed amount per delivered
-- load, a single status flip) with real driver settlements: a
-- per-driver pay method (percentage of the load's rate, per-mile, or a
-- flat rate per load) that computes each load's pay, plus deductions,
-- reimbursements, and cash advances folded in, producing one net
-- payout — and a real PDF statement, not just a database row.
--
-- The existing `payments` table (0001) is left completely alone — it's
-- already historical ledger data (every row in it today is real, paid
-- money), not something to migrate or repurpose. It keeps working for
-- read/history exactly as before; new payouts go through settlements
-- from here on. A load can only ever be paid through one mechanism or
-- the other — enforced by both flows' own "eligible loads" queries
-- excluding whatever the other one already claimed, not a database
-- constraint (same query-time-exclusion pattern the load board already
-- uses for "driver_id is null", not a CHECK).

-- ============================================================================
-- drivers.pay_type / pay_rate — nullable: a driver with neither set
-- keeps working exactly like before (each load's dispatches.driver_pay
-- is typed by hand and that's what a settlement uses for their line).
-- Deliberately not surfaced on the Drivers page itself — configured
-- inline from the Settlements flow instead, the one place it's
-- actually used, rather than growing the Drivers table with columns
-- that only matter at payout time.
-- ============================================================================

alter table public.drivers
  add column pay_type text check (pay_type in ('percentage_of_rate', 'per_mile', 'flat_per_load')),
  add column pay_rate numeric(10, 4) check (pay_rate is null or pay_rate >= 0);

-- ============================================================================
-- settlements — one per driver payout. Amount is never stored here —
-- same "derived, never written" reasoning as loads' margin and
-- invoices' total: it's the sum of this settlement's line items,
-- computed at read time.
-- ============================================================================

create table public.settlements (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  driver_id   uuid not null references public.drivers (id),

  status      text not null default 'draft' check (status in ('draft', 'paid', 'void')),
  paid_at     timestamptz,
  notes       text,

  created_at  timestamptz not null default now()
);

create index settlements_company_id_idx on public.settlements (company_id);
create index settlements_driver_id_idx  on public.settlements (driver_id);

-- ============================================================================
-- settlement_line_items — load_pay (load_id set, computed from the
-- driver's pay method), deduction, reimbursement, or advance_repayment
-- (load_id null for all three of those). Positive amounts throughout;
-- line_type says whether it adds to or subtracts from the net, so a
-- settlement's total is always sum(load_pay + reimbursement) -
-- sum(deduction + advance_repayment), computed wherever it's shown, the
-- same way invoice totals and load margins already are.
-- ============================================================================

create table public.settlement_line_items (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  settlement_id  uuid not null references public.settlements (id) on delete cascade,
  load_id        uuid references public.loads (id) on delete set null,

  line_type      text not null check (line_type in ('load_pay', 'deduction', 'reimbursement', 'advance_repayment')),
  description    text not null,
  amount         numeric(10, 2) not null default 0 check (amount >= 0),

  created_at     timestamptz not null default now()
);

create index settlement_line_items_company_id_idx    on public.settlement_line_items (company_id);
create index settlement_line_items_settlement_id_idx on public.settlement_line_items (settlement_id);
create index settlement_line_items_load_id_idx       on public.settlement_line_items (load_id);

-- ============================================================================
-- driver_advances — cash given to a driver ahead of a settlement
-- (fuel, an emergency repair, whatever). Outstanding advances become
-- selectable deduction candidates the next time that driver's
-- settlement is created; settlement_id links back to whichever
-- settlement actually repaid it once that happens.
-- ============================================================================

create table public.driver_advances (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  driver_id      uuid not null references public.drivers (id),

  amount         numeric(10, 2) not null check (amount > 0),
  reason         text,
  status         text not null default 'outstanding' check (status in ('outstanding', 'repaid')),
  settlement_id  uuid references public.settlements (id) on delete set null,

  created_at     timestamptz not null default now()
);

create index driver_advances_company_id_idx on public.driver_advances (company_id);
create index driver_advances_driver_id_idx  on public.driver_advances (driver_id);

-- ============================================================================
-- RLS — staff: same owner/dispatcher/admin CRUD, no delete, pattern as
-- every other operational table. Drivers: read-only visibility into
-- their own settlements/line items — this is what finally lets
-- app/driver/page.tsx's "running settlement total" placeholder (§78)
-- show a real number instead of a promise.
-- ============================================================================

alter table public.settlements enable row level security;

create policy "select own company settlements"
  on public.settlements for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company settlements"
  on public.settlements for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company settlements"
  on public.settlements for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "drivers can view their own settlements"
  on public.settlements for select
  using (
    exists (
      select 1 from public.drivers d
      where d.id = settlements.driver_id
        and d.user_id = auth.uid()
        and d.status = 'active'
    )
  );

alter table public.settlement_line_items enable row level security;

create policy "select own company settlement line items"
  on public.settlement_line_items for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company settlement line items"
  on public.settlement_line_items for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company settlement line items"
  on public.settlement_line_items for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "drivers can view their own settlement line items"
  on public.settlement_line_items for select
  using (
    exists (
      select 1 from public.settlements s
      join public.drivers d on d.id = s.driver_id
      where s.id = settlement_line_items.settlement_id
        and d.user_id = auth.uid()
        and d.status = 'active'
    )
  );

alter table public.driver_advances enable row level security;

create policy "select own company driver advances"
  on public.driver_advances for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company driver advances"
  on public.driver_advances for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company driver advances"
  on public.driver_advances for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- Same past-due write lock as every other "new work" insert
-- (dispatches, invoices) — creating a settlement or handing out an
-- advance is new work the same way those are.
create trigger enforce_payment_write_lock_settlements
  before insert on public.settlements
  for each row
  execute function public.enforce_payment_write_lock();

create trigger enforce_payment_write_lock_driver_advances
  before insert on public.driver_advances
  for each row
  execute function public.enforce_payment_write_lock();

-- ============================================================================
-- create_settlement() — the one place a settlement gets created. Each
-- load's pay is computed client-side (percentage/per-mile/flat all
-- need at minimum the load's own rate, and per-mile also needs a miles
-- figure the form collects interactively — there's no mileage data yet
-- to compute it server-side; see the Phase 3c note on the deferred
-- Google Maps mileage add-on) and passed in already-resolved, the same
-- way CreateLoadForm shows a live margin before submitting rather than
-- trusting the database to recompute and reveal it after the fact.
-- This function's job is purely the atomic multi-insert (settlement +
-- every line item + marking any repaid advances), not the pay math.
-- NOT security definer — runs as the caller, RLS applies exactly as if
-- the client had called each insert directly.
-- ============================================================================

create function public.create_settlement(
  p_company_id  uuid,
  p_driver_id   uuid,
  p_line_items  jsonb,   -- [{load_id: uuid|null, line_type: text, description: text, amount: numeric}, ...]
  p_advance_ids uuid[],
  p_notes       text
)
returns uuid
language plpgsql
as $$
declare
  new_settlement_id uuid;
  item              jsonb;
begin
  insert into public.settlements (company_id, driver_id, notes)
  values (p_company_id, p_driver_id, p_notes)
  returning id into new_settlement_id;

  for item in select * from jsonb_array_elements(p_line_items) loop
    insert into public.settlement_line_items (company_id, settlement_id, load_id, line_type, description, amount)
    values (
      p_company_id,
      new_settlement_id,
      nullif(item->>'load_id', '')::uuid,
      item->>'line_type',
      item->>'description',
      (item->>'amount')::numeric
    );
  end loop;

  if p_advance_ids is not null and array_length(p_advance_ids, 1) > 0 then
    update public.driver_advances
    set status = 'repaid', settlement_id = new_settlement_id
    where id = any(p_advance_ids)
      and driver_id = p_driver_id
      and status = 'outstanding';
  end if;

  return new_settlement_id;
end;
$$;

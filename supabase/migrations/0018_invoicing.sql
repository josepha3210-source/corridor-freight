-- Corridor Freight — Phase 4a: Invoicing
-- Bill a customer for one or more delivered loads. Same shape as the
-- rest of the app's money-adjacent features: a per-company auto-number
-- (mirrors load_number, 0002), no hard delete (archive via a `void`
-- status, same reasoning as 0002/0003), and totals computed from line
-- items rather than stored — the same "margin is derived, never
-- written" philosophy loads' client_rate/driver_pay already established,
-- applied here to invoice totals so they can never drift out of sync
-- with the line items they're built from.

-- ============================================================================
-- invoices
-- ============================================================================

alter table public.companies
  add column next_invoice_number integer not null default 1;

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  customer_id     uuid not null references public.contacts (id),

  invoice_number  text,
  status          text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),

  issued_at       date not null default current_date,
  due_at          date,
  notes           text,

  created_at      timestamptz not null default now()
);

create index invoices_company_id_idx  on public.invoices (company_id);
create index invoices_customer_id_idx on public.invoices (customer_id);

-- Same per-company counter pattern as set_load_number (0002) — a row
-- lock on companies for the duration of the transaction so two invoices
-- created at once for the same company still get distinct numbers.
create function public.set_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_number integer;
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    update public.companies
      set next_invoice_number = next_invoice_number + 1
      where id = new.company_id
      returning next_invoice_number - 1 into assigned_number;

    new.invoice_number := 'INV-' || lpad(assigned_number::text, 4, '0');
  end if;

  return new;
end;
$$;

create trigger set_invoice_number_before_insert
  before insert on public.invoices
  for each row execute function public.set_invoice_number();

-- ============================================================================
-- invoice_line_items — load_id is nullable: set for a line item
-- generated from a delivered load's rate, null for a freeform line
-- (accessorials, detention, anything not tied to a specific load).
-- company_id denormalized here rather than joining through invoices for
-- every RLS check — same reasoning 0016/0017 used for their own child
-- tables (contacts/trucks, load_stops).
-- ============================================================================

create table public.invoice_line_items (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  load_id      uuid references public.loads (id) on delete set null,

  description  text not null,
  amount       numeric(10, 2) not null default 0 check (amount >= 0),

  created_at   timestamptz not null default now()
);

create index invoice_line_items_company_id_idx on public.invoice_line_items (company_id);
create index invoice_line_items_invoice_id_idx on public.invoice_line_items (invoice_id);
create index invoice_line_items_load_id_idx    on public.invoice_line_items (load_id);

-- ============================================================================
-- RLS — same owner/dispatcher/admin CRUD, no delete, pattern as every
-- other operational table (drivers, loads, trucks, contacts, dispatches).
-- ============================================================================

alter table public.invoices enable row level security;

create policy "select own company invoices"
  on public.invoices for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company invoices"
  on public.invoices for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company invoices"
  on public.invoices for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

alter table public.invoice_line_items enable row level security;

create policy "select own company invoice line items"
  on public.invoice_line_items for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company invoice line items"
  on public.invoice_line_items for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company invoice line items"
  on public.invoice_line_items for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- Creating an invoice is "new work" the same way a new load/driver/
-- dispatch is — same past-due write lock (0014), same defense-in-depth
-- reasoning as wiring it onto dispatches in 0017.
create trigger enforce_payment_write_lock_invoices
  before insert on public.invoices
  for each row
  execute function public.enforce_payment_write_lock();

-- ============================================================================
-- create_invoice_with_line_items() — the one place an invoice gets
-- created. One call inserts the invoice and every line item (one per
-- delivered load passed in, plus an optional freeform extra line) so an
-- invoice is never left with some of its lines missing. NOT security
-- definer — runs as the caller, RLS on both tables applies exactly as
-- if the client had called them directly. Same philosophy as 0017's
-- create_load_with_dispatch().
-- ============================================================================

create function public.create_invoice_with_line_items(
  p_company_id        uuid,
  p_customer_id       uuid,
  p_load_ids          uuid[],
  p_due_at            date,
  p_extra_description text,
  p_extra_amount      numeric
)
returns uuid
language plpgsql
as $$
declare
  new_invoice_id uuid;
  ln             public.loads%rowtype;
begin
  insert into public.invoices (company_id, customer_id, due_at)
  values (p_company_id, p_customer_id, p_due_at)
  returning id into new_invoice_id;

  for ln in select * from public.loads where id = any(p_load_ids) loop
    insert into public.invoice_line_items (company_id, invoice_id, load_id, description, amount)
    values (p_company_id, new_invoice_id, ln.id, ln.load_number || ' — ' || ln.client_name, ln.client_rate);
  end loop;

  if p_extra_description is not null and btrim(p_extra_description) <> '' then
    insert into public.invoice_line_items (company_id, invoice_id, load_id, description, amount)
    values (p_company_id, new_invoice_id, null, p_extra_description, coalesce(p_extra_amount, 0));
  end if;

  return new_invoice_id;
end;
$$;

-- Corridor Freight — Phase 5c: Document management
-- Storage-based (a private bucket, not public like company-logos —
-- CDLs and insurance certs are sensitive, unlike a logo), feeding the
-- dashboard's "Needs attention soon" panel (§78) alongside trucks'
-- own registration/insurance/inspection dates and maintenance's
-- next_due_at — this is the third and final piece that panel was
-- always meant to show, now that all three exist.

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  driver_id   uuid references public.drivers (id) on delete set null,
  truck_id    uuid references public.trucks (id) on delete set null,

  category    text not null check (category in (
    'driver_license', 'driver_medical_card', 'truck_registration',
    'truck_insurance', 'company_insurance', 'other'
  )),
  title       text not null,
  file_path   text not null, -- object path within the company-documents bucket
  expires_at  date,

  created_at  timestamptz not null default now()
);

create index documents_company_id_idx on public.documents (company_id);
create index documents_driver_id_idx  on public.documents (driver_id);
create index documents_truck_id_idx   on public.documents (truck_id);
create index documents_expires_at_idx on public.documents (expires_at);

-- Unlike loads/drivers/trucks, documents are file attachments, not
-- ledger records — a superseded insurance cert has no ongoing
-- historical value the way a paid invoice does, so this one genuinely
-- gets a delete policy, matching the company-logos bucket's own
-- replace/delete allowance (0012) rather than the "archive via status,
-- never delete" convention everywhere else.
alter table public.documents enable row level security;

create policy "select own company documents"
  on public.documents for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company documents"
  on public.documents for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company documents"
  on public.documents for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "delete own company documents"
  on public.documents for delete
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- ============================================================================
-- storage: company-documents — private (public: false), unlike
-- company-logos. Object path convention: {company_id}/{filename} —
-- same storage.foldername(name)[1] = current_company_id() pattern 0012
-- already established, just private this time so read also needs the
-- role/company check, not just bucket membership.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do nothing;

create policy "owner/dispatcher/admin can view own company documents"
  on storage.objects for select
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() in ('owner', 'dispatcher', 'admin')
  );

create policy "owner/dispatcher/admin can upload own company documents"
  on storage.objects for insert
  with check (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() in ('owner', 'dispatcher', 'admin')
  );

create policy "owner/dispatcher/admin can delete own company documents"
  on storage.objects for delete
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() in ('owner', 'dispatcher', 'admin')
  );

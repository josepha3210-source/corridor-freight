-- Corridor Freight — Settings page additions
-- Three independent schema additions: per-profile notification
-- preferences, and a company logo (Supabase Storage). Nothing new
-- needed for Security (password change goes through Supabase Auth
-- directly) or the Danger Zone (deletes existing rows via their
-- existing cascades, no new schema).

-- ============================================================================
-- notification preferences
-- ----------------------------------------------------------------------------
-- Storage only — see ROADMAP.md for the corresponding gap: nothing in
-- this app currently sends an email for any of these three events, so
-- these preferences aren't wired to an actual send yet. They're real,
-- saved, per-profile settings ready for whenever that's built.
-- ============================================================================

alter table public.profiles
  add column notify_load_delivered   boolean not null default true,
  add column notify_payment_awaiting boolean not null default true,
  add column notify_new_teammate     boolean not null default true;

-- ============================================================================
-- company logo (Supabase Storage)
-- ----------------------------------------------------------------------------
-- logo_updated_at is null until a logo's ever been uploaded, and doubles
-- as a cache-busting query param on the public URL — every upload
-- overwrites the same object path (<company_id>/logo), so without this a
-- browser that already cached the old image would keep showing it after
-- a replacement.
-- ============================================================================

alter table public.companies
  add column logo_updated_at timestamptz;

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

-- Logos are genuinely public content (they can appear on delivery
-- confirmation records), so read is unrestricted — matches the bucket's
-- own public flag. Write is scoped to the uploader's own company via the
-- object path's first folder segment (storage.foldername(name) is
-- Supabase's own documented pattern for this), and to owner/admin —
-- matching the Company section this belongs next to, not Billing's
-- stricter owner-only boundary.
create policy "anyone can view company logos"
  on storage.objects for select
  using (bucket_id = 'company-logos');

create policy "owner/admin can upload own company logo"
  on storage.objects for insert
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() in ('owner', 'admin')
  );

create policy "owner/admin can replace own company logo"
  on storage.objects for update
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() in ('owner', 'admin')
  )
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() in ('owner', 'admin')
  );

create policy "owner/admin can delete own company logo"
  on storage.objects for delete
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.current_user_role() in ('owner', 'admin')
  );

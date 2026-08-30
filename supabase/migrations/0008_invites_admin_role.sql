-- Corridor Freight — Phase 5 follow-up
-- 0007 widened profiles_role_check and every RLS policy that reasons
-- about the 'admin' role, but missed that invites.role has its OWN
-- separate check constraint (from 0004: dispatcher/driver only) — a
-- completely different constraint from profiles_role_check, on a
-- different table, that also needed widening. Caught live: inviting an
-- admin failed with a raw Postgres constraint-violation error rather
-- than actually sending the invite.

alter table public.invites drop constraint invites_role_check;
alter table public.invites
  add constraint invites_role_check check (role in ('dispatcher', 'driver', 'admin'));

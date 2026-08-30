-- Corridor Freight — Phase 2 migration
-- Extends the archive-not-delete decision made for loads (0002) to
-- drivers and payments: both should only ever move through their status
-- column, never be hard-deletable, even via a direct API call.

drop policy "delete own company payments" on public.payments;
drop policy "delete own company drivers" on public.drivers;

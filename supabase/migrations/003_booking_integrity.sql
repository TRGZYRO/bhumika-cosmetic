-- 003_booking_integrity.sql
-- Fixes booking inserts and closes the anonymous booking bypass.
--
-- Before this migration:
--   * booking_reference was NOT NULL with no default, so every insert failed.
--   * booking_time was NOT NULL and the app wrote start_time only, so inserts failed.
--   * "Customers can create bookings" allowed anyone to insert directly,
--     skipping the capacity check.
--
-- Public bookings now go through /api/create-booking, which uses the service
-- role and enforces capacity. Staff create offline bookings from the admin page.

-- 1. Human-friendly reference, e.g. RQ-3F9A1C2B
alter table bookings
  alter column booking_reference
  set default ('RQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

-- 2. Keep the legacy booking_time column and the newer start_time in sync
create or replace function sync_booking_times()
returns trigger
language plpgsql
as $$
begin
  if new.start_time is null then
    new.start_time := new.booking_time;
  end if;
  if new.booking_time is null then
    new.booking_time := new.start_time;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_sync_times on bookings;
create trigger bookings_sync_times
  before insert or update on bookings
  for each row execute function sync_booking_times();

-- 3. Remove the anonymous insert path
drop policy if exists "Customers can create bookings" on bookings;

-- 4. Staff (owner, manager, staff) may create bookings directly, e.g. walk-ins
create policy "Staff can create bookings"
  on bookings for insert
  to authenticated
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager', 'staff')
    )
  );

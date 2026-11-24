-- 012_fix_addresses_firebase_uid.sql
--
-- Fixes: "Server error: invalid input syntax for type uuid: \"<firebase uid>\""
-- when saving a delivery address.
--
-- Migration 005 converted every user-scoped column to text because Firebase UIDs
-- are not UUIDs. Migration 010 (saved addresses) was written after that and still
-- declared addresses.user_id as uuid, referencing auth.users. So inserting an
-- address with a Firebase UID always failed.
--
-- This migration makes addresses match the rest of the schema. Safe to re-run.

do $$ begin
  if to_regclass('public.addresses') is null then
    create table addresses (
      id uuid default uuid_generate_v4() primary key,
      user_id text not null,
      label text not null default 'Home',
      full_name text not null,
      phone text not null,
      address_line1 text not null,
      address_line2 text,
      city text not null,
      state text not null,
      pincode text not null,
      landmark text,
      latitude numeric(10, 8),
      longitude numeric(11, 8),
      is_default boolean default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  end if;
end $$;

-- Drop the policies first. PostgreSQL will not change a column's type while a
-- policy depends on it. They are recreated below with text-safe casts.
drop policy if exists "Users can view own addresses" on addresses;
drop policy if exists "Users can insert own addresses" on addresses;
drop policy if exists "Users can update own addresses" on addresses;
drop policy if exists "Users can delete own addresses" on addresses;

-- Drop the old link to auth.users (Firebase replaces Supabase Auth).
alter table addresses drop constraint if exists addresses_user_id_fkey;

-- Firebase UIDs are text, so the column must be text too.
alter table addresses alter column user_id type text using user_id::text;

-- Link to profiles instead. NOT VALID: existing rows are not re-checked, new rows are.
alter table addresses drop constraint if exists addresses_user_id_profiles_fkey;
alter table addresses add constraint addresses_user_id_profiles_fkey
  foreign key (user_id) references profiles(id) on delete cascade not valid;

-- Row level security: the API uses the service role, but keep policies correct
-- and type-safe for any direct access.
alter table addresses enable row level security;


create policy "Users can view own addresses"
  on addresses for select
  using (user_id = auth.uid()::text);

create policy "Users can insert own addresses"
  on addresses for insert
  with check (user_id = auth.uid()::text);

create policy "Users can update own addresses"
  on addresses for update
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create policy "Users can delete own addresses"
  on addresses for delete
  using (user_id = auth.uid()::text);

create index if not exists idx_addresses_user on addresses(user_id);
create index if not exists idx_addresses_default on addresses(user_id, is_default) where is_default = true;

-- 010: Saved addresses with map location support for customers
-- Allows multiple delivery addresses per user with lat/lng for map pinning

-- Addresses table
create table if not exists addresses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null default 'Home', -- e.g., 'Home', 'Work', 'Other'
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

alter table addresses enable row level security;

-- Users can manage their own addresses
create policy "Users can view own addresses"
  on addresses for select
  using (user_id = auth.uid());

create policy "Users can insert own addresses"
  on addresses for insert
  with check (user_id = auth.uid());

create policy "Users can update own addresses"
  on addresses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own addresses"
  on addresses for delete
  using (user_id = auth.uid());

-- Index for performance
create index if not exists idx_addresses_user on addresses(user_id);
create index if not exists idx_addresses_default on addresses(user_id, is_default) where is_default = true;

-- Trigger to ensure only one default address per user
create or replace function ensure_single_default_address()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update addresses set is_default = false where user_id = new.user_id and id != new.id;
  end if;
  return new;
end $$;

drop trigger if exists trigger_single_default_address on addresses;
create trigger trigger_single_default_address
  before insert or update on addresses
  for each row execute function ensure_single_default_address();
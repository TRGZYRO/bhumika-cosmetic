-- 014: makes the coupons table complete, and adds a per-customer usage limit.
--
-- Run this ONE file in the Supabase SQL editor. It is safe to run more than once, and
-- also fixes a table created from an earlier version of 013 (the "column description
-- not found in schema cache" error).

-- Combo offers on products (also in 013).
alter table products add column if not exists combo_quantity integer
  check (combo_quantity is null or combo_quantity >= 2);
alter table products add column if not exists combo_price numeric(10, 2)
  check (combo_price is null or combo_price >= 0);

-- Coupons table. Creates it if missing, then makes sure every column exists.
create table if not exists coupons (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  created_at timestamptz default now()
);

alter table coupons add column if not exists description text;
alter table coupons add column if not exists discount_type text;
alter table coupons add column if not exists discount_value numeric(10, 2);
alter table coupons add column if not exists min_order_amount numeric(10, 2) not null default 0;
alter table coupons add column if not exists max_discount_amount numeric(10, 2);
alter table coupons add column if not exists usage_limit integer;
alter table coupons add column if not exists times_used integer not null default 0;
alter table coupons add column if not exists per_customer_limit integer;
alter table coupons add column if not exists valid_until timestamptz;
alter table coupons add column if not exists is_active boolean not null default true;
alter table coupons add column if not exists updated_at timestamptz default now();

-- Checks (added only if not already there).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'coupons_discount_type_check') then
    alter table coupons add constraint coupons_discount_type_check check (discount_type in ('percent', 'fixed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_per_customer_check') then
    alter table coupons add constraint coupons_per_customer_check check (per_customer_limit is null or per_customer_limit >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_usage_limit_check') then
    alter table coupons add constraint coupons_usage_limit_check check (usage_limit is null or usage_limit >= 1);
  end if;
end $$;

-- Older coupons tables can have extra required columns (for example "type" or "value")
-- from an earlier design. The app does not use them, so let them be empty. If an old
-- "type" / "value" column exists, its data is copied into discount_type / discount_value
-- for coupons that lack it.
do $$
declare col record;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coupons' and column_name = 'type') then
    update coupons set discount_type = type
      where discount_type is null and type in ('percent', 'fixed');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coupons' and column_name = 'value') then
    update coupons set discount_value = value
      where discount_value is null and value > 0;
  end if;
  for col in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'coupons' and is_nullable = 'NO'
      and column_name not in ('id', 'code', 'discount_type', 'discount_value', 'min_order_amount', 'times_used', 'is_active', 'created_at')
  loop
    execute format('alter table public.coupons alter column %I drop not null', col.column_name);
  end loop;
end $$;

-- Only the server (service role) reads and writes coupons.
alter table coupons enable row level security;

-- Orders record the coupon used.
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists discount_amount numeric(10, 2) not null default 0;

-- Tell the API to reload its schema cache, so the new columns are visible at once.
notify pgrst, 'reload schema';

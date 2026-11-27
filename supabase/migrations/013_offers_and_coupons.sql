-- 013: combo offers on products, and discount coupons.
--
-- Run after 001-012. Safe to run once.
--
--  1. Combo offer per product: "buy <combo_quantity> for <combo_price>", e.g. 2 for ₹199.
--     Both columns empty means no offer.
--  2. Coupons: percent or fixed-amount discount codes, with optional minimum order,
--     maximum discount, usage limit, expiry date and on/off switch.
--  3. Orders record the coupon code used (discount_amount already exists).

-- 1. Combo offers ---------------------------------------------------------
alter table products add column if not exists combo_quantity integer
  check (combo_quantity is null or combo_quantity >= 2);
alter table products add column if not exists combo_price numeric(10, 2)
  check (combo_price is null or combo_price >= 0);

-- 2. Coupons --------------------------------------------------------------
create table if not exists coupons (
  id uuid default gen_random_uuid() primary key,
  code text not null unique check (code = upper(code) and char_length(code) between 3 and 30),
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  min_order_amount numeric(10, 2) not null default 0 check (min_order_amount >= 0),
  max_discount_amount numeric(10, 2) check (max_discount_amount is null or max_discount_amount >= 0),
  usage_limit integer check (usage_limit is null or usage_limit >= 1),
  times_used integer not null default 0 check (times_used >= 0),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint coupon_percent_max check (discount_type <> 'percent' or discount_value <= 100)
);

-- Coupons are only read and written by the server (service role), like orders and settings.
-- With RLS on and no policies, the public browser key cannot see or change them.
alter table coupons enable row level security;

-- 3. Orders record which coupon was used ----------------------------------
alter table orders add column if not exists coupon_code text;

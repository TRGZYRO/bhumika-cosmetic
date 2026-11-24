-- 009: convert the café database to Bhumika Cosmetic (online cosmetics shop).
--
-- Run after 001-008. Safe to run once; uses "if not exists" where possible.
--
--  1. Products get brand, size, stock, MRP (compare-at price) and how-to-use text.
--  2. Customers get a saved delivery address.
--  3. Business settings: cafe_name becomes shop_name, plus a free-delivery threshold.
--  4. Café categories are replaced by cosmetic categories.

-- 1. Products -------------------------------------------------------------
alter table products add column if not exists brand text;
alter table products add column if not exists size_label text;
alter table products add column if not exists stock_quantity integer not null default 0 check (stock_quantity >= 0);
alter table products add column if not exists compare_at_price numeric(10, 2) check (compare_at_price >= 0);
alter table products add column if not exists how_to_use text;

create index if not exists idx_products_brand on products(brand);

-- 2. Customer address -----------------------------------------------------
alter table profiles add column if not exists address text;

-- 3. Business settings ----------------------------------------------------
alter table business_settings rename column cafe_name to shop_name;
alter table business_settings add column if not exists free_delivery_above numeric(10, 2) default 0;
alter table business_settings alter column delivery_charge set default 49;

update business_settings
set shop_name = 'Bhumika Cosmetic',
    tagline = 'Beauty essentials for every day, delivered to your door.',
    delivery_charge = 49,
    free_delivery_above = 499,
    currency = 'INR',
    updated_at = now();

-- 4. Categories -----------------------------------------------------------
-- Remove the café categories. Products that used them keep existing with category_id = null.
delete from categories where slug in ('coffee', 'mocktails', 'comfort-food', 'desserts');

insert into categories (name, slug, description, sort_order) values
  ('Makeup', 'makeup', 'Foundation, lipsticks, eyeshadow and everything for a flawless look.', 1),
  ('Skincare', 'skincare', 'Cleansers, serums, moisturisers and sun care for healthy skin.', 2),
  ('Hair Care', 'hair-care', 'Shampoos, conditioners, masks and styling essentials.', 3),
  ('Fragrance', 'fragrance', 'Perfumes, body mists and signature scents.', 4),
  ('Bath & Body', 'bath-body', 'Body washes, lotions and self-care indulgence.', 5)
on conflict (slug) do nothing;

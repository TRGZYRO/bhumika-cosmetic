-- RaunaQ House — Complete Database Schema
-- Phase 13 — Database and Backend Architecture
-- Supabase PostgreSQL

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Profiles & Authentication
-- ============================================================

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  phone text,
  email text,
  avatar_url text,
  role text default 'customer' check (role in ('customer', 'staff', 'manager', 'owner')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on profiles
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

create policy "Users can insert own profile"
  on profiles for insert
  with check ( auth.uid() = id );

-- ============================================================
-- User Roles & Staff Permissions
-- ============================================================

create table user_roles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('owner', 'manager', 'staff', 'customer')),
  assigned_by uuid references auth.users,
  assigned_at timestamptz default now(),
  unique (user_id, role)
);

alter table user_roles enable row level security;

create policy "Admins can view all user roles"
  on user_roles for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

create policy "Users can view own roles"
  on user_roles for select
  using ( user_id = auth.uid() );

create policy "Only owners can assign roles"
  on user_roles for insert
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
    )
  );

create table staff_permissions (
  id uuid default uuid_generate_v4() primary key,
  role text not null check (role in ('owner', 'manager', 'staff')),
  can_manage_orders boolean default false,
  can_manage_bookings boolean default false,
  can_manage_menu boolean default false,
  can_view_analytics boolean default false,
  can_manage_staff boolean default false,
  can_manage_settings boolean default false,
  can_view_refunds boolean default false,
  created_at timestamptz default now(),
  unique (role)
);

alter table staff_permissions enable row level security;

create policy "Admins can view staff permissions"
  on staff_permissions for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- Default permissions
insert into staff_permissions (role, can_manage_orders, can_manage_bookings, can_manage_menu, can_view_analytics, can_manage_staff, can_manage_settings, can_view_refunds) values
('owner', true, true, true, true, true, true, true),
('manager', true, true, true, true, false, false, false),
('staff', true, true, false, false, false, false, false);

-- ============================================================
-- Categories
-- ============================================================

create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table categories enable row level security;

create policy "Categories are viewable by everyone"
  on categories for select
  using ( is_active = true );

create policy "Admins can manage categories"
  on categories for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Products
-- ============================================================

create table products (
  id uuid default uuid_generate_v4() primary key,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  short_description text,
  base_price numeric(10, 2) not null check (base_price >= 0),
  image_url text,
  is_veg boolean default true,
  is_available boolean default true,
  is_featured boolean default false,
  preparation_estimate text,
  ingredients text,
  dietary_info text,
  seo_title text,
  seo_description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table products enable row level security;

create policy "Products are viewable by everyone"
  on products for select
  using ( is_available = true );

create policy "Admins can manage products"
  on products for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Product Images
-- ============================================================

create table product_images (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  image_url text not null,
  alt_text text,
  sort_order integer default 0,
  is_primary boolean default false,
  created_at timestamptz default now()
);

alter table product_images enable row level security;

create policy "Product images are viewable by everyone"
  on product_images for select
  using ( true );

create policy "Admins can manage product images"
  on product_images for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Product Variants (sizes, etc.)
-- ============================================================

create table product_variants (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  name text not null,
  price_adjustment numeric(10, 2) default 0,
  is_available boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table product_variants enable row level security;

create policy "Product variants are viewable by everyone"
  on product_variants for select
  using ( true );

create policy "Admins can manage product variants"
  on product_variants for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Product Add-ons
-- ============================================================

create table product_addons (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  max_selections integer default 1,
  is_available boolean default true,
  created_at timestamptz default now()
);

alter table product_addons enable row level security;

create policy "Product addons are viewable by everyone"
  on product_addons for select
  using ( is_available = true );

create policy "Admins can manage product addons"
  on product_addons for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Product Recommendations
-- ============================================================

create table product_recommendations (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  recommended_product_id uuid references products(id) on delete cascade not null,
  reason text,
  sort_order integer default 0,
  unique (product_id, recommended_product_id)
);

alter table product_recommendations enable row level security;

create policy "Product recommendations are viewable by everyone"
  on product_recommendations for select
  using ( true );

-- ============================================================
-- Wishlists
-- ============================================================

create table wishlists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text default 'My Wishlist',
  created_at timestamptz default now(),
  unique (user_id, name)
);

alter table wishlists enable row level security;

create policy "Users can manage own wishlists"
  on wishlists for all
  using ( user_id = auth.uid() );

create table wishlist_items (
  id uuid default uuid_generate_v4() primary key,
  wishlist_id uuid references wishlists(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (wishlist_id, product_id)
);

alter table wishlist_items enable row level security;

create policy "Users can manage own wishlist items"
  on wishlist_items for all
  using (
    exists (
      select 1 from wishlists w where w.id = wishlist_id and w.user_id = auth.uid()
    )
  );

-- ============================================================
-- Carts
-- ============================================================

create table carts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete set null,
  session_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table carts enable row level security;

create policy "Users can manage own carts"
  on carts for all
  using ( user_id = auth.uid() OR (user_id is null and session_id = current_setting('app.session_id', true)) );

create table cart_items (
  id uuid default uuid_generate_v4() primary key,
  cart_id uuid references carts(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  variant_id uuid references product_variants(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  special_instructions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table cart_items enable row level security;

create policy "Users can manage own cart items"
  on cart_items for all
  using (
    exists (
      select 1 from carts c where c.id = cart_id and (c.user_id = auth.uid() OR c.session_id = current_setting('app.session_id', true))
    )
  );

-- ============================================================
-- Orders
-- ============================================================

create table orders (
  id uuid default uuid_generate_v4() primary key,
  order_number text not null unique,
  user_id uuid references auth.users on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  fulfilment_method text not null check (fulfilment_method in ('delivery', 'pickup', 'dine-in')),
  delivery_address text,
  special_instructions text,
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  tax_amount numeric(10, 2) default 0 check (tax_amount >= 0),
  delivery_charge numeric(10, 2) default 0 check (delivery_charge >= 0),
  discount_amount numeric(10, 2) default 0 check (discount_amount >= 0),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  order_status text default 'pending' check (order_status in ('pending', 'confirmed', 'rejected', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'refund_pending', 'partially_refunded')),
  payment_provider text,
  payment_reference text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table orders enable row level security;

create policy "Customers can view own orders"
  on orders for select
  using ( user_id = auth.uid() );

create policy "Admins can view all orders"
  on orders for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager', 'staff')
    )
  );

create policy "Customers can create orders"
  on orders for insert
  with check ( true );

create policy "Admins can update orders"
  on orders for update
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager', 'staff')
    )
  );

-- ============================================================
-- Order Items
-- ============================================================

create table order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  variant_name text,
  variant_price_adjustment numeric(10, 2) default 0,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  total_price numeric(10, 2) not null check (total_price >= 0),
  addons jsonb default '[]',
  special_instructions text,
  created_at timestamptz default now()
);

alter table order_items enable row level security;

create policy "Customers can view own order items"
  on order_items for select
  using (
    exists (
      select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy "Admins can view all order items"
  on order_items for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager', 'staff')
    )
  );

-- ============================================================
-- Order Status History
-- ============================================================

create table order_status_history (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade not null,
  status text not null,
  changed_by uuid references auth.users,
  changed_at timestamptz default now(),
  note text
);

alter table order_status_history enable row level security;

create policy "Customers can view own order status history"
  on order_status_history for select
  using (
    exists (
      select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy "Admins can manage order status history"
  on order_status_history for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager', 'staff')
    )
  );

-- ============================================================
-- Payments
-- ============================================================

create table payments (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade not null,
  amount numeric(10, 2) not null check (amount >= 0),
  provider text not null,
  provider_reference text,
  status text default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  raw_response jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table payments enable row level security;

create policy "Customers can view own payments"
  on payments for select
  using (
    exists (
      select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy "Admins can view all payments"
  on payments for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager', 'staff')
    )
  );

-- ============================================================
-- Refunds
-- ============================================================

create table refunds (
  id uuid default uuid_generate_v4() primary key,
  payment_id uuid references payments(id) on delete cascade not null,
  order_id uuid references orders(id) on delete cascade not null,
  amount numeric(10, 2) not null check (amount > 0),
  reason text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  provider_reference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table refunds enable row level security;

create policy "Customers can view own refunds"
  on refunds for select
  using (
    exists (
      select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy "Admins can manage refunds"
  on refunds for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Bookings (Reservations)
-- ============================================================

create table bookings (
  id uuid default uuid_generate_v4() primary key,
  booking_reference text not null unique,
  user_id uuid references auth.users on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  booking_date date not null,
  booking_time time not null,
  guests integer not null check (guests > 0),
  status text default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  special_requests text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table bookings enable row level security;

create policy "Customers can view own bookings"
  on bookings for select
  using ( user_id = auth.uid() );

create policy "Admins can view all bookings"
  on bookings for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager', 'staff')
    )
  );

create policy "Customers can create bookings"
  on bookings for insert
  with check ( true );

create policy "Admins can update bookings"
  on bookings for update
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager', 'staff')
    )
  );

-- ============================================================
-- Booking Slots (capacity management)
-- ============================================================

create table booking_slots (
  id uuid default uuid_generate_v4() primary key,
  slot_date date not null,
  slot_time time not null,
  capacity integer not null default 20,
  booked_count integer not null default 0,
  is_active boolean default true,
  unique (slot_date, slot_time)
);

alter table booking_slots enable row level security;

create policy "Booking slots are viewable by everyone"
  on booking_slots for select
  using ( is_active = true );

create policy "Admins can manage booking slots"
  on booking_slots for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Coupons
-- ============================================================

create table coupons (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  type text not null check (type in ('percentage', 'fixed')),
  value numeric(10, 2) not null check (value > 0),
  min_order numeric(10, 2) default 0,
  max_discount numeric(10, 2),
  usage_limit integer,
  used_count integer default 0,
  expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table coupons enable row level security;

create policy "Coupons are viewable by everyone"
  on coupons for select
  using ( is_active = true );

create policy "Admins can manage coupons"
  on coupons for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Coupon Usage
-- ============================================================

create table coupon_usage (
  id uuid default uuid_generate_v4() primary key,
  coupon_id uuid references coupons(id) on delete cascade not null,
  order_id uuid references orders(id) on delete cascade not null,
  used_at timestamptz default now()
);

alter table coupon_usage enable row level security;

create policy "Customers can view own coupon usage"
  on coupon_usage for select
  using (
    exists (
      select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- ============================================================
-- Business Settings
-- ============================================================

create table business_settings (
  id uuid default uuid_generate_v4() primary key,
  cafe_name text default 'RaunaQ House',
  tagline text,
  address text,
  phone text,
  email text,
  opening_hours jsonb default '[]',
  logo_url text,
  ordering_enabled boolean default true,
  delivery_enabled boolean default false,
  pickup_enabled boolean default true,
  dine_in_enabled boolean default true,
  minimum_order numeric(10, 2) default 0,
  delivery_charge numeric(10, 2) default 0,
  tax_rate numeric(5, 4) default 0,
  currency text default 'INR',
  updated_at timestamptz default now()
);

alter table business_settings enable row level security;

create policy "Business settings are viewable by everyone"
  on business_settings for select
  using ( true );

create policy "Only owners can update business settings"
  on business_settings for update
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
    )
  );

-- ============================================================
-- Notifications
-- ============================================================

create table notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null,
  title text not null,
  message text,
  data jsonb default '{}',
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

create policy "Users can manage own notifications"
  on notifications for all
  using ( user_id = auth.uid() );

-- ============================================================
-- Reviews
-- ============================================================

create table reviews (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text,
  comment text,
  is_verified boolean default false,
  created_at timestamptz default now(),
  unique (product_id, user_id)
);

alter table reviews enable row level security;

create policy "Reviews are viewable by everyone"
  on reviews for select
  using ( true );

create policy "Users can manage own reviews"
  on reviews for all
  using ( user_id = auth.uid() );

-- ============================================================
-- Audit Logs
-- ============================================================

create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete set null,
  action text not null,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz default now()
);

alter table audit_logs enable row level security;

create policy "Admins can view audit logs"
  on audit_logs for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

create policy "System can insert audit logs"
  on audit_logs for insert
  with check ( true );

-- ============================================================
-- Indexes for performance
-- ============================================================

create index idx_products_category on products(category_id);
create index idx_products_slug on products(slug);
create index idx_products_featured on products(is_featured);
create index idx_order_items_order on order_items(order_id);
create index idx_orders_user on orders(user_id);
create index idx_orders_status on orders(order_status);
create index idx_orders_created on orders(created_at);
create index idx_bookings_date on bookings(booking_date);
create index idx_bookings_user on bookings(user_id);
create index idx_wishlist_items_product on wishlist_items(product_id);
create index idx_cart_items_cart on cart_items(cart_id);
create index idx_payments_order on payments(order_id);
create index idx_notifications_user on notifications(user_id);
create index idx_reviews_product on reviews(product_id);

-- ============================================================
-- Seed default categories
-- ============================================================

insert into categories (name, slug, description, sort_order) values
('Coffee', 'coffee', 'Aromatic espresso drinks, crafted with care.', 1),
('Mocktails', 'mocktails', 'Refreshing, alcohol-free blends for every mood.', 2),
('Comfort Food', 'comfort-food', 'Warm, satisfying dishes for any time of day.', 3),
('Desserts', 'desserts', 'Indulgent sweet treats to end on a high note.', 4);

-- ============================================================
-- Seed default business settings
-- ============================================================

insert into business_settings (cafe_name, tagline, address, phone, email, opening_hours, currency) values
('RaunaQ House',
 'A cosy Indian café where comforting flavours, refreshing drinks and warm company come together.',
 'Etah Aligarh Bypass Rd, Telephone Colony, Arjun Nagar, Aligarh, Uttar Pradesh 202001',
 '06396900995',
 '',
 '[
   {"days": "Mon – Thu", "time": "8:00 AM – 10:00 PM"},
   {"days": "Fri – Sat", "time": "8:00 AM – 11:00 PM"},
   {"days": "Sunday", "time": "9:00 AM – 9:00 PM"}
 ]',
 'INR');

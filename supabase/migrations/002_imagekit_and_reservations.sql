-- RaunaQ House — ImageKit + Advanced Reservations Migration
-- Part of Phase 2 — ImageKit integration and advanced reservation system
-- Preserves all existing tables from 001_initial_schema.sql

-- ============================================================
-- ImageKit image metadata storage
-- ============================================================

create table imagekit_images (
  id uuid default uuid_generate_v4() primary key,
  file_id text not null unique,
  url text not null,
  thumbnail_url text,
  filename text not null,
  folder text,
  mime_type text,
  size_bytes integer,
  width integer,
  height integer,
  alt_text text,
  associated_type text check (associated_type in ('product', 'category', 'banner', 'gallery', 'hero', 'logo', 'other')),
  associated_id uuid,
  display_order integer default 0,
  uploaded_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table imagekit_images enable row level security;

create policy "ImageKit images are viewable by everyone"
  on imagekit_images for select
  using ( true );

create policy "Admins can manage imagekit images"
  on imagekit_images for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

create index idx_imagekit_images_associated on imagekit_images(associated_type, associated_id);
create index idx_imagekit_images_folder on imagekit_images(folder);
create index idx_imagekit_images_uploaded_by on imagekit_images(uploaded_by);

-- ============================================================
-- Tables (for table management in reservation system)
-- ============================================================

create table tables (
  id uuid default uuid_generate_v4() primary key,
  table_number text not null unique,
  name text,
  capacity integer not null check (capacity > 0),
  is_active boolean default true,
  is_combinable boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tables enable row level security;

create policy "Tables are viewable by everyone"
  on tables for select
  using ( is_active = true );

create policy "Admins can manage tables"
  on tables for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

-- ============================================================
-- Enhanced bookings: add duration, end_time, source, table_id
-- ============================================================

alter table bookings
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists duration_minutes integer default 60,
  add column if not exists booking_source text default 'website' check (booking_source in ('website', 'walk-in', 'phone', 'staff-created')),
  add column if not exists table_id uuid references tables(id) on delete set null,
  add column if not exists guests_seated integer;

-- Migrate existing booking_time to start_time if start_time is null
update bookings set start_time = booking_time where start_time is null;

-- ============================================================
-- Booking settings (owner-configurable)
-- ============================================================

create table booking_settings (
  id uuid default uuid_generate_v4() primary key,
  default_duration_minutes integer not null default 60,
  allowed_durations jsonb not null default '["30", "60", "90", "120"]',
  buffer_minutes integer not null default 15,
  total_capacity integer not null default 8,
  opening_time time not null default '08:00',
  closing_time time not null default '22:00',
  table_level_allocation boolean default false,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table booking_settings enable row level security;

create policy "Booking settings are viewable by everyone"
  on booking_settings for select
  using ( true );

create policy "Only owners can update booking settings"
  on booking_settings for update
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'owner'
    )
  );

insert into booking_settings (default_duration_minutes, allowed_durations, buffer_minutes, total_capacity, opening_time, closing_time, table_level_allocation, timezone) values
(60, '["30", "60", "90", "120"]', 15, 8, '08:00', '22:00', false, 'Asia/Kolkata');

-- ============================================================
-- Table assignments for bookings (when table-level allocation is on)
-- ============================================================

create table booking_table_assignments (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references bookings(id) on delete cascade not null,
  table_id uuid references tables(id) on delete cascade not null,
  assigned_at timestamptz default now(),
  assigned_by uuid references auth.users on delete set null,
  unique (table_id, booking_id)
);

alter table booking_table_assignments enable row level security;

create policy "Booking table assignments are viewable by everyone"
  on booking_table_assignments for select
  using ( true );

create policy "Admins can manage table assignments"
  on booking_table_assignments for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('owner', 'manager')
    )
  );

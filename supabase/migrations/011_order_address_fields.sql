-- 011: Add detailed address fields to orders table
-- Stores city, state, landmark, and lat/lng for map location

alter table orders add column if not exists delivery_city text;
alter table orders add column if not exists delivery_state text;
alter table orders add column if not exists delivery_landmark text;
alter table orders add column if not exists delivery_latitude numeric(10, 8);
alter table orders add column if not exists delivery_longitude numeric(11, 8);

-- Add indexes for location-based queries
create index if not exists idx_orders_location on orders(delivery_latitude, delivery_longitude);
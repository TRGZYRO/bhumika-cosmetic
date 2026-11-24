-- 005_firebase_uid_text.sql
-- Convert UUID columns to text so Firebase UIDs (non-UUID strings) can be used.
-- Firebase replaces Supabase Auth, so auth.users references are replaced with
-- references to profiles.id (which now stores the Firebase UID as text).
-- Safe to re-run: skips tables/columns that don't exist yet.
--
-- IMPORTANT: All DDL is executed via dynamic SQL (EXECUTE) inside DO blocks so
-- the script never references a table that doesn't exist. RLS policies that
-- reference altered columns are dropped and recreated with auth.uid()::text
-- casts. The app accesses user-scoped data via /api routes (Firebase ID token
-- verification, server-side), so Supabase RLS is a secondary layer here.

-- Helper: run a statement only if the table exists.
-- We use separate DO blocks per table so PL/pgSQL never compiles static SQL
-- against a missing relation.

-- ============================================================
-- profiles: id uuid -> text (was referencing auth.users)
-- ============================================================
do $$ begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "Users can view own profile" on profiles';
    execute 'drop policy if exists "Users can update own profile" on profiles';
    execute 'drop policy if exists "Users can insert own profile" on profiles';
    execute 'drop policy if exists "Public profiles are viewable by everyone" on profiles';
    execute 'alter table profiles drop constraint if exists profiles_id_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'profiles' and column_name = 'id' and data_type = 'uuid'
    ) then
      execute 'alter table profiles alter column id type text using id::text';
    end if;

    execute 'create policy "Public profiles are viewable by everyone" on profiles for select using ( true )';
    execute 'create policy "Users can update own profile" on profiles for update using ( auth.uid()::text = id )';
    execute 'create policy "Users can insert own profile" on profiles for insert with check ( auth.uid()::text = id )';
  end if;
end $$;

-- ============================================================
-- user_roles: user_id & assigned_by -> text
-- ============================================================
do $$ begin
  if to_regclass('public.user_roles') is not null then
    execute 'drop policy if exists "Admins can view all user roles" on user_roles';
    execute 'drop policy if exists "Users can view own roles" on user_roles';
    execute 'drop policy if exists "Only owners can assign roles" on user_roles';
    execute 'alter table user_roles drop constraint if exists user_roles_user_id_fkey';
    execute 'alter table user_roles drop constraint if exists user_roles_assigned_by_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'user_roles' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      execute 'alter table user_roles alter column user_id type text using user_id::text';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_name = 'user_roles' and column_name = 'assigned_by' and data_type = 'uuid'
    ) then
      execute 'alter table user_roles alter column assigned_by type text using assigned_by::text';
    end if;

    execute 'alter table user_roles add constraint user_roles_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'user_roles' and column_name = 'assigned_by'
    ) then
      execute 'alter table user_roles add constraint user_roles_assigned_by_fkey foreign key (assigned_by) references profiles(id) on delete set null';
    end if;

    execute 'create policy "Admins can view all user roles" on user_roles for select using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
    execute 'create policy "Users can view own roles" on user_roles for select using ( user_id = auth.uid()::text )';
    execute 'create policy "Only owners can assign roles" on user_roles for insert with check ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role = ''owner''))';
  end if;
end $$;

-- ============================================================
-- wishlists: user_id -> text
-- ============================================================
do $$ begin
  if to_regclass('public.wishlists') is not null then
    execute 'drop policy if exists "Users can manage own wishlists" on wishlists';
    execute 'alter table wishlists drop constraint if exists wishlists_user_id_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'wishlists' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      execute 'alter table wishlists alter column user_id type text using user_id::text';
    end if;

    execute 'alter table wishlists add constraint wishlists_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade';
    execute 'create policy "Users can manage own wishlists" on wishlists for all using ( user_id = auth.uid()::text )';
  end if;
end $$;

-- ============================================================
-- wishlist_items: references wishlists.user_id via subquery - cast auth.uid().
-- ============================================================
do $$ begin
  if to_regclass('public.wishlist_items') is not null then
    execute 'drop policy if exists "Users can manage own wishlist items" on wishlist_items';
    execute 'create policy "Users can manage own wishlist items" on wishlist_items for all using ( exists (select 1 from wishlists w where w.id = wishlist_id and w.user_id = auth.uid()::text) )';
  end if;
end $$;

-- ============================================================
-- carts: user_id -> text
-- ============================================================
do $$ begin
  if to_regclass('public.carts') is not null then
    execute 'drop policy if exists "Users can manage own carts" on carts';
    execute 'alter table carts drop constraint if exists carts_user_id_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'carts' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      execute 'alter table carts alter column user_id type text using user_id::text';
    end if;

    execute 'alter table carts add constraint carts_user_id_fkey foreign key (user_id) references profiles(id) on delete set null';
    execute 'create policy "Users can manage own carts" on carts for all using ( user_id = auth.uid()::text or (user_id is null and session_id = current_setting(''app.session_id'', true)) )';
  end if;
end $$;

-- ============================================================
-- cart_items: references carts.user_id via subquery - cast auth.uid().
-- ============================================================
do $$ begin
  if to_regclass('public.cart_items') is not null then
    execute 'drop policy if exists "Users can manage own cart items" on cart_items';
    execute 'create policy "Users can manage own cart items" on cart_items for all using ( exists (select 1 from carts c where c.id = cart_id and (c.user_id = auth.uid()::text or (c.user_id is null and c.session_id = current_setting(''app.session_id'', true)))) )';
  end if;
end $$;

-- ============================================================
-- orders: user_id -> text
-- ============================================================
do $$ begin
  if to_regclass('public.orders') is not null then
    execute 'drop policy if exists "Customers can view own orders" on orders';
    execute 'drop policy if exists "Admins can view all orders" on orders';
    execute 'drop policy if exists "Customers can create orders" on orders';
    execute 'drop policy if exists "Admins can update orders" on orders';
    execute 'alter table orders drop constraint if exists orders_user_id_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'orders' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      execute 'alter table orders alter column user_id type text using user_id::text';
    end if;

    execute 'alter table orders add constraint orders_user_id_fkey foreign key (user_id) references profiles(id) on delete set null';
    execute 'create policy "Customers can view own orders" on orders for select using ( user_id = auth.uid()::text )';
    execute 'create policy "Admins can view all orders" on orders for select using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'', ''staff'')) )';
    execute 'create policy "Customers can create orders" on orders for insert with check ( true )';
    execute 'create policy "Admins can update orders" on orders for update using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'', ''staff'')) )';
  end if;
end $$;

-- ============================================================
-- order_items: references orders.user_id via subquery - cast auth.uid().
-- ============================================================
do $$ begin
  if to_regclass('public.order_items') is not null then
    execute 'drop policy if exists "Customers can view own order items" on order_items';
    execute 'drop policy if exists "Admins can view all order items" on order_items';
    execute 'create policy "Customers can view own order items" on order_items for select using ( exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()::text) )';
    execute 'create policy "Admins can view all order items" on order_items for select using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'', ''staff'')) )';
  end if;
end $$;

-- ============================================================
-- order_status_history: references orders.user_id + changed_by -> text
-- ============================================================
do $$ begin
  if to_regclass('public.order_status_history') is not null then
    execute 'drop policy if exists "Customers can view own order status history" on order_status_history';
    execute 'drop policy if exists "Admins can manage order status history" on order_status_history';
    execute 'alter table order_status_history drop constraint if exists order_status_history_changed_by_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'order_status_history' and column_name = 'changed_by' and data_type = 'uuid'
    ) then
      execute 'alter table order_status_history alter column changed_by type text using changed_by::text';
    end if;

    execute 'alter table order_status_history add constraint order_status_history_changed_by_fkey foreign key (changed_by) references profiles(id) on delete set null';
    execute 'create policy "Customers can view own order status history" on order_status_history for select using ( exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()::text) )';
    execute 'create policy "Admins can manage order status history" on order_status_history for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'', ''staff'')) )';
  end if;
end $$;

-- ============================================================
-- payments: references orders.user_id via subquery - cast auth.uid().
-- ============================================================
do $$ begin
  if to_regclass('public.payments') is not null then
    execute 'drop policy if exists "Customers can view own payments" on payments';
    execute 'drop policy if exists "Admins can view all payments" on payments';
    execute 'create policy "Customers can view own payments" on payments for select using ( exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()::text) )';
    execute 'create policy "Admins can view all payments" on payments for select using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'', ''staff'')) )';
  end if;
end $$;

-- ============================================================
-- refunds: references orders.user_id via subquery - cast auth.uid().
-- ============================================================
do $$ begin
  if to_regclass('public.refunds') is not null then
    execute 'drop policy if exists "Customers can view own refunds" on refunds';
    execute 'drop policy if exists "Admins can manage refunds" on refunds';
    execute 'create policy "Customers can view own refunds" on refunds for select using ( exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()::text) )';
    execute 'create policy "Admins can manage refunds" on refunds for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- bookings: user_id -> text
-- ============================================================
do $$ begin
  if to_regclass('public.bookings') is not null then
    execute 'drop policy if exists "Customers can view own bookings" on bookings';
    execute 'drop policy if exists "Admins can view all bookings" on bookings';
    execute 'drop policy if exists "Staff can create bookings" on bookings';
    execute 'drop policy if exists "Admins can update bookings" on bookings';
    execute 'alter table bookings drop constraint if exists bookings_user_id_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'bookings' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      execute 'alter table bookings alter column user_id type text using user_id::text';
    end if;

    execute 'alter table bookings add constraint bookings_user_id_fkey foreign key (user_id) references profiles(id) on delete set null';
    execute 'create policy "Customers can view own bookings" on bookings for select using ( user_id = auth.uid()::text )';
    execute 'create policy "Admins can view all bookings" on bookings for select using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'', ''staff'')) )';
    execute 'create policy "Staff can create bookings" on bookings for insert to authenticated with check ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'', ''staff'')) )';
    execute 'create policy "Admins can update bookings" on bookings for update using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'', ''staff'')) )';
  end if;
end $$;

-- ============================================================
-- booking_table_assignments: assigned_by -> text
-- ============================================================
do $$ begin
  if to_regclass('public.booking_table_assignments') is not null then
    execute 'drop policy if exists "Booking table assignments are viewable by everyone" on booking_table_assignments';
    execute 'drop policy if exists "Admins can manage table assignments" on booking_table_assignments';
    execute 'alter table booking_table_assignments drop constraint if exists booking_table_assignments_assigned_by_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'booking_table_assignments' and column_name = 'assigned_by' and data_type = 'uuid'
    ) then
      execute 'alter table booking_table_assignments alter column assigned_by type text using assigned_by::text';
    end if;

    execute 'alter table booking_table_assignments add constraint booking_table_assignments_assigned_by_fkey foreign key (assigned_by) references profiles(id) on delete set null';
    execute 'create policy "Booking table assignments are viewable by everyone" on booking_table_assignments for select using ( true )';
    execute 'create policy "Admins can manage table assignments" on booking_table_assignments for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- imagekit_images: uploaded_by -> text
-- ============================================================
do $$ begin
  if to_regclass('public.imagekit_images') is not null then
    execute 'drop policy if exists "ImageKit images are viewable by everyone" on imagekit_images';
    execute 'drop policy if exists "Admins can manage imagekit images" on imagekit_images';
    execute 'alter table imagekit_images drop constraint if exists imagekit_images_uploaded_by_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'imagekit_images' and column_name = 'uploaded_by' and data_type = 'uuid'
    ) then
      execute 'alter table imagekit_images alter column uploaded_by type text using uploaded_by::text';
    end if;

    execute 'alter table imagekit_images add constraint imagekit_images_uploaded_by_fkey foreign key (uploaded_by) references profiles(id) on delete set null';
    execute 'create policy "ImageKit images are viewable by everyone" on imagekit_images for select using ( true )';
    execute 'create policy "Admins can manage imagekit images" on imagekit_images for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- notifications: user_id -> text
-- ============================================================
do $$ begin
  if to_regclass('public.notifications') is not null then
    execute 'drop policy if exists "Users can manage own notifications" on notifications';
    execute 'alter table notifications drop constraint if exists notifications_user_id_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'notifications' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      execute 'alter table notifications alter column user_id type text using user_id::text';
    end if;

    execute 'alter table notifications add constraint notifications_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade';
    execute 'create policy "Users can manage own notifications" on notifications for all using ( user_id = auth.uid()::text )';
  end if;
end $$;

-- ============================================================
-- reviews: user_id -> text
-- ============================================================
do $$ begin
  if to_regclass('public.reviews') is not null then
    execute 'drop policy if exists "Reviews are viewable by everyone" on reviews';
    execute 'drop policy if exists "Users can manage own reviews" on reviews';
    execute 'alter table reviews drop constraint if exists reviews_user_id_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'reviews' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      execute 'alter table reviews alter column user_id type text using user_id::text';
    end if;

    execute 'alter table reviews add constraint reviews_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade';
    execute 'create policy "Reviews are viewable by everyone" on reviews for select using ( true )';
    execute 'create policy "Users can manage own reviews" on reviews for all using ( user_id = auth.uid()::text )';
  end if;
end $$;

-- ============================================================
-- audit_logs: user_id -> text
-- ============================================================
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    execute 'drop policy if exists "Admins can view audit logs" on audit_logs';
    execute 'drop policy if exists "System can insert audit logs" on audit_logs';
    execute 'alter table audit_logs drop constraint if exists audit_logs_user_id_fkey';

    if exists (
      select 1 from information_schema.columns
      where table_name = 'audit_logs' and column_name = 'user_id' and data_type = 'uuid'
    ) then
      execute 'alter table audit_logs alter column user_id type text using user_id::text';
    end if;

    execute 'alter table audit_logs add constraint audit_logs_user_id_fkey foreign key (user_id) references profiles(id) on delete set null';
    execute 'create policy "Admins can view audit logs" on audit_logs for select using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
    execute 'create policy "System can insert audit logs" on audit_logs for insert with check ( true )';
  end if;
end $$;

-- ============================================================
-- business_settings: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.business_settings') is not null then
    execute 'drop policy if exists "Business settings are viewable by everyone" on business_settings';
    execute 'drop policy if exists "Only owners can update business settings" on business_settings';
    execute 'create policy "Business settings are viewable by everyone" on business_settings for select using ( true )';
    execute 'create policy "Only owners can update business settings" on business_settings for update using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role = ''owner''))';
  end if;
end $$;

-- ============================================================
-- categories: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.categories') is not null then
    execute 'drop policy if exists "Categories are viewable by everyone" on categories';
    execute 'drop policy if exists "Admins can manage categories" on categories';
    execute 'create policy "Categories are viewable by everyone" on categories for select using ( is_active = true )';
    execute 'create policy "Admins can manage categories" on categories for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- products: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.products') is not null then
    execute 'drop policy if exists "Products are viewable by everyone" on products';
    execute 'drop policy if exists "Admins can manage products" on products';
    execute 'create policy "Products are viewable by everyone" on products for select using ( is_available = true )';
    execute 'create policy "Admins can manage products" on products for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- product_images: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.product_images') is not null then
    execute 'drop policy if exists "Product images are viewable by everyone" on product_images';
    execute 'drop policy if exists "Admins can manage product images" on product_images';
    execute 'create policy "Product images are viewable by everyone" on product_images for select using ( true )';
    execute 'create policy "Admins can manage product images" on product_images for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- product_variants: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.product_variants') is not null then
    execute 'drop policy if exists "Product variants are viewable by everyone" on product_variants';
    execute 'drop policy if exists "Admins can manage product variants" on product_variants';
    execute 'create policy "Product variants are viewable by everyone" on product_variants for select using ( true )';
    execute 'create policy "Admins can manage product variants" on product_variants for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- product_addons: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.product_addons') is not null then
    execute 'drop policy if exists "Product addons are viewable by everyone" on product_addons';
    execute 'drop policy if exists "Admins can manage product addons" on product_addons';
    execute 'create policy "Product addons are viewable by everyone" on product_addons for select using ( is_available = true )';
    execute 'create policy "Admins can manage product addons" on product_addons for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- product_recommendations: policy uses true - recreate for safety.
-- ============================================================
do $$ begin
  if to_regclass('public.product_recommendations') is not null then
    execute 'drop policy if exists "Product recommendations are viewable by everyone" on product_recommendations';
    execute 'create policy "Product recommendations are viewable by everyone" on product_recommendations for select using ( true )';
  end if;
end $$;

-- ============================================================
-- coupon_usage: references orders.user_id via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.coupon_usage') is not null then
    execute 'drop policy if exists "Customers can view own coupon usage" on coupon_usage';
    execute 'create policy "Customers can view own coupon usage" on coupon_usage for select using ( exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()::text) )';
  end if;
end $$;

-- ============================================================
-- tables: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.tables') is not null then
    execute 'drop policy if exists "Tables are viewable by everyone" on tables';
    execute 'drop policy if exists "Admins can manage tables" on tables';
    execute 'create policy "Tables are viewable by everyone" on tables for select using ( is_active = true )';
    execute 'create policy "Admins can manage tables" on tables for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- booking_slots: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.booking_slots') is not null then
    execute 'drop policy if exists "Booking slots are viewable by everyone" on booking_slots';
    execute 'drop policy if exists "Admins can manage booking slots" on booking_slots';
    execute 'create policy "Booking slots are viewable by everyone" on booking_slots for select using ( is_active = true )';
    execute 'create policy "Admins can manage booking slots" on booking_slots for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- coupons: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.coupons') is not null then
    execute 'drop policy if exists "Coupons are viewable by everyone" on coupons';
    execute 'drop policy if exists "Admins can manage coupons" on coupons';
    execute 'create policy "Coupons are viewable by everyone" on coupons for select using ( is_active = true )';
    execute 'create policy "Admins can manage coupons" on coupons for all using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

-- ============================================================
-- staff_permissions: policies reference user_roles via subquery - cast.
-- ============================================================
do $$ begin
  if to_regclass('public.staff_permissions') is not null then
    execute 'drop policy if exists "Admins can view staff permissions" on staff_permissions';
    execute 'create policy "Admins can view staff permissions" on staff_permissions for select using ( exists (select 1 from user_roles ur where ur.user_id = auth.uid()::text and ur.role in (''owner'', ''manager'')) )';
  end if;
end $$;

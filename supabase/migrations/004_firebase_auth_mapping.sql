-- 004_firebase_auth_mapping.sql
-- Map Firebase Auth UIDs to existing Supabase profiles.
--
-- Firebase replaces Supabase Authentication only. The Supabase database stays
-- intact: profiles.id, user_roles, bookings, orders, carts, wishlists etc. all
-- keep their existing relationships to profiles.id.
--
-- This migration adds a `firebase_uid` column to profiles so each Firebase
-- user can be linked to their existing profile row. A unique index lets us
-- look up a profile by Firebase UID server-side (after verifying the Firebase
-- ID token), without trusting any frontend-supplied user ID.

alter table profiles
  add column if not exists firebase_uid text unique;

create index if not exists idx_profiles_firebase_uid on profiles(firebase_uid);

-- Backfill: for any demo/dev local accounts there is nothing to backfill
-- (Supabase auth.users rows are not migrated). New Firebase sign-ups create
-- or link a profile via firebase_uid in AuthContext.signUp.

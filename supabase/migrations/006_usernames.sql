-- Usernames for profiles (chosen after Google registration).
-- Stored lowercase; unique; 3-20 chars of letters, digits or underscore.

alter table profiles add column if not exists username text;

alter table profiles drop constraint if exists profiles_username_format;
alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists idx_profiles_username_unique on profiles(username);

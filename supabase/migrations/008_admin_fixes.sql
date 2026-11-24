-- 008: admin panel fixes.
--  1. Remove the policies on user_roles that query user_roles itself. They cause
--     "infinite recursion detected in policy for relation user_roles". Admin
--     access now goes through the server (/api/admin-data), which uses the
--     service role, so these browser-side policies are not needed.
--  2. Public storage bucket for menu images (replaces ImageKit).

drop policy if exists "Admins can view all user roles" on user_roles;
drop policy if exists "Only owners can assign roles" on user_roles;

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

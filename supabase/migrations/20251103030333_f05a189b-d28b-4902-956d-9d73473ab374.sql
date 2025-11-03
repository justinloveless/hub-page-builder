-- Fix site_members RLS policy to allow members to see all members of their sites
drop policy if exists "Members can view site memberships" on site_members;

create policy "Members can view site memberships"
on site_members for select
to authenticated
using (
  is_site_member(site_id) OR ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
);
-- Fix infinite recursion in site_members RLS policy
-- The issue is that the "Members can list memberships" policy uses is_site_member()
-- which queries site_members, causing infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Members can list memberships" ON public.site_members;

-- Create a simpler policy that doesn't cause recursion
CREATE POLICY "Members can view site memberships"
ON public.site_members
FOR SELECT
USING (
  user_id = auth.uid() 
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
);
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Owners can manage memberships" ON public.site_members;
DROP POLICY IF EXISTS "Members can view site memberships" ON public.site_members;

-- Create a security definer function to check site ownership
CREATE OR REPLACE FUNCTION public.is_site_owner(target_site_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  result boolean;
begin
  select exists (
    select 1
    from public.site_members sm
    where sm.site_id = target_site_id
      and sm.user_id = auth.uid()
      and sm.role = 'owner'
  ) into result;
  return coalesce(result, false);
end;
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Members can view site memberships"
ON public.site_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR (auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Owners can manage memberships"
ON public.site_members
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'service_role'
  OR public.is_site_owner(site_id)
)
WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role'
  OR public.is_site_owner(site_id)
);
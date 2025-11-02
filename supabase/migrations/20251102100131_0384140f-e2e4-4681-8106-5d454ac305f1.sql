-- Fix the is_site_member function - remove the problematic SET command
-- SECURITY DEFINER already bypasses RLS, so we don't need to disable it
CREATE OR REPLACE FUNCTION public.is_site_member(target_site_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  result boolean;
begin
  select exists (
    select 1
    from public.site_members sm
    where sm.site_id = target_site_id
      and sm.user_id = auth.uid()
  ) into result;
  return coalesce(result, false);
end;
$function$;
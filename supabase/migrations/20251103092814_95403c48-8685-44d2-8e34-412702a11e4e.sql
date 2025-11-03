-- Allow site owners to delete sites
CREATE POLICY "Owners can delete sites" 
ON public.sites 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1
    FROM public.site_members sm
    WHERE sm.site_id = sites.id
      AND sm.user_id = auth.uid()
      AND sm.role = 'owner'
  )
);
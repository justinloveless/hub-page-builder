-- Phase 1: Critical Security Fixes

-- ============================================================================
-- 1. Fix Invitations Table RLS Policies
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view invitations" ON public.invitations;

-- Create restrictive policies for viewing invitations
CREATE POLICY "Site owners can view their site invitations"
ON public.invitations
FOR SELECT
USING (
  public.is_site_owner(site_id) OR 
  (auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can view invitations sent to their email"
ON public.invitations
FOR SELECT
USING (
  (email IS NOT NULL AND email = auth.email()) OR
  (auth.jwt() ->> 'role') = 'service_role'
);

-- ============================================================================
-- 2. Fix GitHub App Config Security
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage GitHub app config" ON public.github_app_config;

-- Recreate with proper restrictions
CREATE POLICY "Service role can manage GitHub app config"
ON public.github_app_config
FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================================================
-- 3. Fix Profiles Table - Add Explicit SELECT Policy
-- ============================================================================

-- Keep the existing ALL policy but add a restrictive SELECT policy
CREATE POLICY "Users can view profiles of site members"
ON public.profiles
FOR SELECT
USING (
  -- Users can view their own profile
  auth.uid() = id OR
  -- Users can view profiles of people in their sites
  EXISTS (
    SELECT 1 
    FROM public.site_members sm1
    INNER JOIN public.site_members sm2 ON sm1.site_id = sm2.site_id
    WHERE sm1.user_id = auth.uid() 
    AND sm2.user_id = profiles.id
  )
);

-- ============================================================================
-- 4. Fix Activity Log - Add Explicit UPDATE/DELETE Denial
-- ============================================================================

-- Add restrictive policies to prevent tampering
CREATE POLICY "Nobody can update activity logs"
ON public.activity_log
FOR UPDATE
USING (false);

CREATE POLICY "Nobody can delete activity logs"
ON public.activity_log
FOR DELETE
USING (false);

-- ============================================================================
-- 5. Add Asset Shares Validation Function
-- ============================================================================

-- Function to validate asset share parameters
CREATE OR REPLACE FUNCTION public.validate_asset_share_params()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate expires_at is in the future
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'expires_at must be in the future';
  END IF;
  
  -- Validate expires_at is not more than 1 year in the future
  IF NEW.expires_at > now() + interval '1 year' THEN
    RAISE EXCEPTION 'expires_at cannot be more than 1 year in the future';
  END IF;
  
  -- Validate max_uploads if set
  IF NEW.max_uploads IS NOT NULL AND (NEW.max_uploads < 1 OR NEW.max_uploads > 1000) THEN
    RAISE EXCEPTION 'max_uploads must be between 1 and 1000';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for asset_shares validation
DROP TRIGGER IF EXISTS validate_asset_share_trigger ON public.asset_shares;
CREATE TRIGGER validate_asset_share_trigger
  BEFORE INSERT OR UPDATE ON public.asset_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_asset_share_params();
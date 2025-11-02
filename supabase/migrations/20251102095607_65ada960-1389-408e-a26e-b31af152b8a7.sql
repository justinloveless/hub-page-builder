-- Add app_id to github_app_config (required for JWT signing)
ALTER TABLE public.github_app_config
ADD COLUMN IF NOT EXISTS app_id text;

-- Fix RLS policy to restrict access to github_app_config
-- Only service role should read credentials
DROP POLICY IF EXISTS "Authenticated users can read GitHub app config" ON public.github_app_config;

CREATE POLICY "Service role can read GitHub app config"
ON public.github_app_config
FOR SELECT
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);
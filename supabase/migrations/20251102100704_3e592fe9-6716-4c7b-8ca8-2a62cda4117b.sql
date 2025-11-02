-- Create a new table for public GitHub app configuration
CREATE TABLE public.github_app_public_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  app_id text,
  client_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.github_app_public_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read public config
CREATE POLICY "Authenticated users can read public GitHub config"
ON public.github_app_public_config
FOR SELECT
TO authenticated
USING (true);

-- Only service role can manage public config
CREATE POLICY "Service role can manage public GitHub config"
ON public.github_app_public_config
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Migrate existing data from github_app_config to github_app_public_config
INSERT INTO public.github_app_public_config (id, slug, app_id, client_id, created_at, updated_at)
SELECT id, slug, app_id, client_id, created_at, updated_at
FROM public.github_app_config;

-- Remove non-sensitive columns from github_app_config
ALTER TABLE public.github_app_config DROP COLUMN IF EXISTS slug;
ALTER TABLE public.github_app_config DROP COLUMN IF EXISTS app_id;
ALTER TABLE public.github_app_config DROP COLUMN IF EXISTS client_id;
-- Fix github_installations table to ensure one installation per user
-- Drop the existing table and recreate with correct constraints

DROP TABLE IF EXISTS public.github_installations CASCADE;

CREATE TABLE public.github_installations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id BIGINT NOT NULL, -- GitHub installation ID
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own installations
CREATE POLICY "Users can view their own installations"
ON public.github_installations
FOR SELECT
USING (auth.uid() = user_id);

-- Only service role can insert/update installations
CREATE POLICY "Service role can manage installations"
ON public.github_installations
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);


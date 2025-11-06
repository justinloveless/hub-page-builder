-- Create table to track GitHub App installations per user
CREATE TABLE public.github_installations (
  id BIGINT PRIMARY KEY, -- GitHub installation ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

-- Create index for faster lookups by user
CREATE INDEX idx_github_installations_user_id ON public.github_installations(user_id);

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


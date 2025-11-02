-- Create table for GitHub app configuration
CREATE TABLE public.github_app_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.github_app_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read configuration
CREATE POLICY "Authenticated users can read GitHub app config"
ON public.github_app_config
FOR SELECT
TO authenticated
USING (true);

-- Only service role can modify configuration
CREATE POLICY "Service role can manage GitHub app config"
ON public.github_app_config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.github_app_config
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
-- Create feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  user_targeting JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read feature flags
CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow authenticated users to insert/update/delete (we can make this more restrictive later)
CREATE POLICY "Authenticated users can manage feature flags"
  ON public.feature_flags
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index on flag_key for fast lookups
CREATE INDEX idx_feature_flags_flag_key ON public.feature_flags(flag_key);
CREATE INDEX idx_feature_flags_enabled ON public.feature_flags(enabled);

-- Insert some default feature flags as examples
INSERT INTO public.feature_flags (flag_key, name, description, enabled)
VALUES
  ('new_dashboard', 'New Dashboard', 'Enable the redesigned dashboard interface', false),
  ('advanced_analytics', 'Advanced Analytics', 'Enable advanced analytics features', false),
  ('beta_features', 'Beta Features', 'Enable access to beta features', false)
ON CONFLICT (flag_key) DO NOTHING;

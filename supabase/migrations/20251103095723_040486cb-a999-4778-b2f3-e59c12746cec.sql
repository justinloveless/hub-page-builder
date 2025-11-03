-- Create asset_shares table for temporary upload links
CREATE TABLE public.asset_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  asset_path text NOT NULL,
  token text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  max_uploads integer DEFAULT NULL,
  upload_count integer NOT NULL DEFAULT 0,
  allowed_extensions text[] DEFAULT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asset_shares ENABLE ROW LEVEL SECURITY;

-- Site members can view and create shares for their sites
CREATE POLICY "Members can view their site shares"
  ON public.asset_shares
  FOR SELECT
  USING (is_site_member(site_id) OR (COALESCE((auth.jwt() ->> 'role'::text), ''::text) = 'service_role'::text));

CREATE POLICY "Members can create shares for their sites"
  ON public.asset_shares
  FOR INSERT
  WITH CHECK (is_site_member(site_id) OR (COALESCE((auth.jwt() ->> 'role'::text), ''::text) = 'service_role'::text));

CREATE POLICY "Members can update their site shares"
  ON public.asset_shares
  FOR UPDATE
  USING (is_site_member(site_id) OR (COALESCE((auth.jwt() ->> 'role'::text), ''::text) = 'service_role'::text));

CREATE POLICY "Members can delete their site shares"
  ON public.asset_shares
  FOR DELETE
  USING (is_site_member(site_id) OR (COALESCE((auth.jwt() ->> 'role'::text), ''::text) = 'service_role'::text));

-- Add updated_at trigger
CREATE TRIGGER update_asset_shares_updated_at
  BEFORE UPDATE ON public.asset_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Create index for token lookups
CREATE INDEX idx_asset_shares_token ON public.asset_shares(token);
CREATE INDEX idx_asset_shares_site_id ON public.asset_shares(site_id);
CREATE INDEX idx_asset_shares_expires_at ON public.asset_shares(expires_at);
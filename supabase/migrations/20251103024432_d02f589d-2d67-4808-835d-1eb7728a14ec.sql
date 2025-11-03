-- Create invitations table
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'manager',
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on token for fast lookups
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_site_id ON public.invitations(site_id);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Site members can view invitations for their sites
CREATE POLICY "Members can view site invitations"
ON public.invitations
FOR SELECT
USING (
  is_site_member(site_id) OR 
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
);

-- Policy: Site owners can create invitations
CREATE POLICY "Owners can create invitations"
ON public.invitations
FOR INSERT
WITH CHECK (
  is_site_owner(site_id) OR 
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
);

-- Policy: Service role and authenticated users can update invitations (for accepting)
CREATE POLICY "Users can accept invitations"
ON public.invitations
FOR UPDATE
USING (
  (status = 'pending' AND expires_at > now()) OR
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
);

-- Policy: Site owners can delete invitations
CREATE POLICY "Owners can delete invitations"
ON public.invitations
FOR DELETE
USING (
  is_site_owner(site_id) OR 
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
);

-- Create trigger to update updated_at
CREATE TRIGGER set_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
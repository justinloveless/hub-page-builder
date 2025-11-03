-- Add invite_code column to invitations table
ALTER TABLE public.invitations 
ADD COLUMN invite_code text UNIQUE;

-- Create index for faster lookups by code
CREATE INDEX idx_invitations_invite_code ON public.invitations(invite_code);
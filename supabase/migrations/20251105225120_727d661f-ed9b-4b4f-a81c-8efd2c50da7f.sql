-- Fix remaining invitations security issue
-- The UPDATE policy was allowing broad SELECT access

DROP POLICY IF EXISTS "Users can accept invitations" ON public.invitations;

-- Create a more restrictive UPDATE policy
-- This policy only allows updates for invitations that:
-- 1. Are sent to the user's email, OR
-- 2. Are being accessed by service role
CREATE POLICY "Users can accept their invitations"
ON public.invitations
FOR UPDATE
USING (
  (
    status = 'pending' AND 
    expires_at > now() AND
    (
      (email IS NOT NULL AND email = auth.email()) OR
      (auth.jwt() ->> 'role') = 'service_role'
    )
  ) OR
  (auth.jwt() ->> 'role') = 'service_role'
);
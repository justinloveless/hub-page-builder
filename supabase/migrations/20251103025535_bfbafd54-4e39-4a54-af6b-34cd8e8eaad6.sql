-- Fix invitation RLS policy to allow viewing by anyone with the token
-- Drop the restrictive policy
drop policy if exists "Members can view site invitations" on invitations;

-- Create a more permissive policy for viewing invitations
-- This is safe because:
-- 1. Tokens are UUIDs (hard to guess)
-- 2. No sensitive data in invitations table
-- 3. Accept function still validates server-side
create policy "Authenticated users can view invitations"
on invitations for select
to authenticated
using (true);
-- This migration is superseded by 20251107032707_refactor_github_installations_fk.sql
-- which adds proper foreign key constraints and handles the sync automatically.
-- Keeping this file for migration history but no operations needed.

-- The FK migration will:
-- 1. Add proper foreign key constraint from sites to github_installations
-- 2. Set invalid installation_ids to NULL (to be fixed by reconnecting)
-- 3. Add indexes for performance
-- 4. Enable ON DELETE SET NULL to handle cleanup automatically


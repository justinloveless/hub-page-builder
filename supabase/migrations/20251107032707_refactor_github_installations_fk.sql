-- Refactor github_installations to use installation_id as primary key
-- and add proper foreign key constraint from sites table

-- Step 1: Store existing data
CREATE TEMP TABLE temp_github_installations AS
SELECT * FROM public.github_installations;

-- Step 2: Drop the old table
DROP TABLE IF EXISTS public.github_installations CASCADE;

-- Step 3: Recreate with installation_id as primary key
CREATE TABLE public.github_installations (
  installation_id BIGINT PRIMARY KEY, -- GitHub installation ID as PK
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- Each user can only have one installation
);

-- Step 4: Restore data
INSERT INTO public.github_installations (installation_id, user_id, account_login, account_type, account_avatar_url, created_at, updated_at)
SELECT installation_id, user_id, account_login, account_type, account_avatar_url, created_at, updated_at
FROM temp_github_installations
ON CONFLICT (installation_id) DO NOTHING;

-- Step 5: Create index for faster lookups by user
CREATE INDEX idx_github_installations_user_id ON public.github_installations(user_id);

-- Step 6: Enable RLS
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies
CREATE POLICY "Users can view their own installations"
ON public.github_installations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage installations"
ON public.github_installations
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Step 8: Remove NOT NULL constraint from sites.github_installation_id (if it exists)
ALTER TABLE public.sites
ALTER COLUMN github_installation_id DROP NOT NULL;

-- Step 9: Update any sites with installation_ids that don't exist in github_installations
-- (set them to NULL so they can be fixed by reconnecting GitHub)
UPDATE public.sites
SET github_installation_id = NULL
WHERE github_installation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.github_installations gi
    WHERE gi.installation_id = sites.github_installation_id
  );

-- Step 10: Add foreign key constraint with ON DELETE SET NULL
-- This means if an installation is removed, sites will have NULL installation_id
ALTER TABLE public.sites
ADD CONSTRAINT fk_sites_github_installation
FOREIGN KEY (github_installation_id)
REFERENCES public.github_installations(installation_id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Step 11: Add index on sites.github_installation_id for FK performance
CREATE INDEX IF NOT EXISTS idx_sites_github_installation_id 
ON public.sites(github_installation_id);

-- Step 12: Add index on sites.created_by if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_sites_created_by 
ON public.sites(created_by);

-- Drop temp table
DROP TABLE temp_github_installations;


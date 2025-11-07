# GitHub Installation ID Sync Fix

## Problem

When a GitHub App is reinstalled, it receives a new `installation_id`. The system was updating the `github_installations` table with the new ID, but existing sites in the `sites` table were still referencing the old installation ID. Additionally, there was no referential integrity between the tables, allowing orphaned installation IDs. This caused 404 errors when trying to create access tokens for GitHub API operations.

### Error Example
```
HttpError: Not Found - https://api.github.com/app/installations/92697440/access_tokens
status: 404
```

The installation ID `92697440` no longer exists because the app was reinstalled and assigned a new ID `93383198`.

## Root Cause

The architecture stores `github_installation_id` in the `sites` table, but there were two issues:

1. **No referential integrity**: Sites could reference installation IDs that don't exist in `github_installations`
2. **No automatic cleanup**: When installations changed, sites were left with stale IDs

When a user reinstalls the GitHub App:

1. ✅ `github_installations` table gets updated with the new installation ID
2. ❌ Existing `sites` records still reference the old installation ID (no FK constraint)
3. ❌ Edge functions query the site and use its stale `github_installation_id`
4. ❌ GitHub API returns 404 because the installation no longer exists

## Solution

### 1. Automatic Sync on Reinstall

Modified `github-installation-details` edge function to automatically update all affected sites when the installation ID changes:

```typescript
// Get the old installation_id before updating
const { data: oldInstallation } = await supabaseClient
  .from('github_installations')
  .select('installation_id')
  .eq('user_id', user.id)
  .single()

// Upsert the new installation
await supabaseClient
  .from('github_installations')
  .upsert({ user_id: user.id, installation_id: new_id, ... })

// Update all sites using the old installation_id
if (oldInstallationId && oldInstallationId !== new_id) {
  await supabaseClient
    .from('sites')
    .update({ github_installation_id: new_id })
    .eq('github_installation_id', oldInstallationId)
    .eq('created_by', user.id)
}
```

**Going forward:** When users reconnect their GitHub account:
1. The old installation record is deleted (triggering `ON DELETE SET NULL` to clear sites)
2. The new installation is inserted
3. All user's sites with NULL installation_id are updated to the new installation_id

### 2. Better Error Messages

Added validation in all edge functions to check if the installation exists before attempting to use it:

```typescript
// Verify the installation exists and is accessible
try {
  await app.octokit.request('GET /app/installations/{installation_id}', {
    installation_id: site.github_installation_id
  })
} catch (installError: any) {
  if (installError.status === 404) {
    throw new Error('GitHub App installation no longer exists. The app may have been uninstalled. Please reconnect your GitHub account and update the site settings.')
  }
  throw installError
}
```

**Affected edge functions:**
- `download-site-files`
- `fetch-site-assets`
- `upload-site-asset`
- `list-directory-assets`
- `delete-site-asset`
- `commit-batch-changes`
- `fetch-asset-content`
- `create-site-assets-pr`

### 3. Database Refactoring with Foreign Keys

**Migration:** `20251107032707_refactor_github_installations_fk.sql`

**Key changes:**

1. **Changed primary key:** `github_installations.installation_id` is now the PK (was `user_id`)
2. **Added foreign key constraint:** `sites.github_installation_id` → `github_installations.installation_id`
3. **Automatic cleanup:** `ON DELETE SET NULL` ensures sites are set to NULL if installation is removed
4. **Referential integrity:** Can't insert invalid installation IDs

```sql
-- Recreate table with installation_id as PK
CREATE TABLE public.github_installations (
  installation_id BIGINT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ... other fields
  UNIQUE(user_id) -- Each user can only have one installation
);

-- Add foreign key constraint with automatic cleanup
ALTER TABLE public.sites
ADD CONSTRAINT fk_sites_github_installation
FOREIGN KEY (github_installation_id)
REFERENCES public.github_installations(installation_id)
ON DELETE SET NULL      -- Auto-cleanup when installation removed
ON UPDATE CASCADE;       -- Auto-update if installation_id changes
```

**Benefits:**
- ✅ **Referential integrity:** Database enforces valid installation IDs
- ✅ **Automatic cleanup:** Sites are set to NULL when installations are removed
- ✅ **Better performance:** Proper indexes on FK relationships
- ✅ **Clearer schema:** Installation ID is the natural key for installations

## How to Fix Immediately

### For Production/Deployed Environments

1. **Deploy the migration:**
   ```bash
   npx supabase db push
   ```
   This will update all existing sites with the correct installation IDs.

2. **Reconnect GitHub account (if needed):**
   - If you haven't already, reconnect your GitHub account in the app
   - This will register the new installation ID and update all your sites automatically

### For Development/Local Environments

1. **Apply the migration:**
   ```bash
   npx supabase migration up
   ```

2. **Or manually fix the database:**
   ```sql
   -- Check which sites have stale installation IDs
   SELECT s.id, s.name, s.github_installation_id as stale_id, gi.installation_id as current_id
   FROM sites s
   JOIN github_installations gi ON s.created_by = gi.user_id
   WHERE s.github_installation_id != gi.installation_id;

   -- Update them
   UPDATE sites
   SET github_installation_id = gi.installation_id
   FROM github_installations gi
   WHERE sites.created_by = gi.user_id
     AND sites.github_installation_id != gi.installation_id;
   ```

## Prevention

This fix ensures that:

1. ✅ **Referential integrity:** Database enforces that sites can only reference valid installations
2. ✅ **Automatic cleanup:** When installations are removed, sites are automatically set to NULL
3. ✅ **Auto-sync on reconnect:** Future GitHub App reinstalls automatically update all affected sites
4. ✅ **Clear error messages:** Users are guided when installation issues occur
5. ✅ **Performance:** Proper indexes and FK relationships optimize queries
6. ✅ **Data consistency:** No orphaned installation IDs possible

## Testing

To verify the fix:

1. Navigate to a site that previously showed the 404 error
2. Try any GitHub operation (download files, upload assets, etc.)
3. Should either:
   - Work correctly (if installation is current)
   - Show helpful error message asking you to reconnect GitHub account

After reconnecting GitHub account:
- All sites should automatically update to use the new installation ID
- All GitHub operations should work normally


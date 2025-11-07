# Refactoring Summary: Foreign Key for GitHub Installations

## Overview

Refactored the `github_installations` table to use proper foreign key constraints, ensuring referential integrity between installations and sites.

## Changes Made

### 1. Database Schema Refactoring

**Migration:** `supabase/migrations/20251107032707_refactor_github_installations_fk.sql`

#### Before
```sql
CREATE TABLE github_installations (
  user_id UUID PRIMARY KEY,          -- PK was user_id
  installation_id BIGINT NOT NULL,   -- Just a column
  ...
);

-- sites table had no FK constraint
CREATE TABLE sites (
  ...
  github_installation_id BIGINT,     -- No FK, could be invalid
  ...
);
```

#### After
```sql
CREATE TABLE github_installations (
  installation_id BIGINT PRIMARY KEY,  -- PK is now installation_id
  user_id UUID NOT NULL,               -- Still unique per user
  ...
  UNIQUE(user_id)                      -- One installation per user
);

-- sites table now has FK constraint
ALTER TABLE sites
ADD CONSTRAINT fk_sites_github_installation
FOREIGN KEY (github_installation_id)
REFERENCES github_installations(installation_id)
ON DELETE SET NULL    -- Auto-cleanup
ON UPDATE CASCADE;    -- Auto-update
```

### 2. Edge Function Updates

#### `github-installation-details/index.ts`

**Before:** Upserted by `user_id`, manually updated sites when installation changed

**After:** 
- Upserts by `installation_id` (new PK)
- Deletes old installation (FK triggers `ON DELETE SET NULL`)
- Updates NULL sites to new installation_id

```typescript
// Get old installation if user had one
const { data: oldInstallation } = await supabaseClient
  .from('github_installations')
  .select('installation_id')
  .eq('user_id', user.id)
  .maybeSingle()

// Upsert new installation (by installation_id)
await supabaseClient
  .from('github_installations')
  .upsert({ 
    installation_id: installation_id,
    user_id: user.id,
    ...
  }, { 
    onConflict: 'installation_id'  // Changed from 'user_id'
  })

// If installation changed, clean up old one
if (oldInstallationId && oldInstallationId !== installation_id) {
  // Delete old installation (FK sets sites to NULL)
  await supabaseClient
    .from('github_installations')
    .delete()
    .eq('installation_id', oldInstallationId)

  // Update user's NULL sites to new installation
  await supabaseClient
    .from('sites')
    .update({ github_installation_id: installation_id })
    .eq('created_by', user.id)
    .is('github_installation_id', null)
}
```

#### `create-site/index.ts`

Changed from `.single()` to `.maybeSingle()` for better error handling:

```typescript
const { data: installation, error: installationError } = await supabaseClient
  .from('github_installations')
  .select('installation_id')
  .eq('installation_id', parseInt(github_installation_id))
  .eq('user_id', user.id)
  .maybeSingle()  // Changed from .single()

if (installationError) {
  throw new Error('Error verifying GitHub installation')
}

if (!installation) {
  throw new Error('GitHub installation not found or not owned by user.')
}
```

### 3. Validation in All Edge Functions

Added installation existence checks to 8 edge functions:
- `download-site-files`
- `fetch-site-assets`
- `upload-site-asset`
- `list-directory-assets`
- `delete-site-asset`
- `commit-batch-changes`
- `fetch-asset-content`
- `create-site-assets-pr`

```typescript
// Verify installation exists before using it
try {
  await app.octokit.request('GET /app/installations/{installation_id}', {
    installation_id: site.github_installation_id
  })
} catch (installError: any) {
  if (installError.status === 404) {
    throw new Error('GitHub App installation no longer exists. Please reconnect your GitHub account.')
  }
  throw installError
}
```

## Benefits

### 1. **Referential Integrity**
- Database enforces that sites can only reference valid installations
- Impossible to have orphaned installation IDs
- Foreign key constraint prevents invalid data

### 2. **Automatic Cleanup**
- `ON DELETE SET NULL`: When installation is removed, sites automatically set to NULL
- No manual cleanup needed
- Consistent state maintained

### 3. **Better Performance**
- Proper indexes on FK relationships
- Faster lookups and joins
- Optimized query plans

### 4. **Simpler Code**
- Database handles referential integrity
- Less manual sync logic needed
- Clearer data model

### 5. **Better User Experience**
- Automatic updates when reconnecting GitHub
- Clear error messages when issues occur
- Sites always have valid installation or NULL

## Migration Path

### Development
```bash
npx supabase migration up
```

### Production
```bash
npx supabase db push
```

The migration:
1. Preserves all existing data
2. Restructures the schema
3. Adds FK constraints
4. Cleans up invalid references (sets to NULL)
5. Adds performance indexes

## Testing Checklist

- [ ] Deploy migration to production
- [ ] Reconnect GitHub account
- [ ] Verify all sites are updated with new installation_id
- [ ] Test GitHub operations (upload, download, etc.)
- [ ] Verify error messages are helpful
- [ ] Check that new sites can only use valid installations

## Rollback Plan

If issues arise, the old migration file `20251106120000_fix_github_installations_unique_user.sql` can be used as reference to revert to the previous schema. However, this is not recommended as the FK approach is significantly better.

## Future Considerations

### Multi-User Installations
If we ever want to support multiple users sharing one installation:

1. Remove `UNIQUE(user_id)` constraint
2. Add a junction table: `github_installation_members`
3. Keep FK constraint on sites
4. Update edge functions to check membership

### Installation Permissions
Could add a `permissions` JSONB column to track what access the installation has:

```sql
ALTER TABLE github_installations
ADD COLUMN permissions JSONB;
```

This would allow checking if the installation has necessary permissions before operations.


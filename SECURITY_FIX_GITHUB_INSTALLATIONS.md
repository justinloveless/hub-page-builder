# Security Fix: GitHub Installations Isolation

## Critical Security Issue

**Severity:** HIGH

**Description:** User B could access and use User A's GitHub App installations when adding sites. The `list-github-installations` edge function was fetching ALL installations for the GitHub App without filtering by the authenticated user.

## The Problem

### Before the Fix

1. **list-github-installations** function:
   - Authenticated the user (✓)
   - Fetched ALL GitHub App installations (✗)
   - Returned installations for every user who installed the app (✗)

2. **create-site** function:
   - Did not verify that the user owns the installation_id they provided
   - Allowed users to specify any installation_id, including those belonging to other users

3. **No tracking table:**
   - No database table to track which user owns which GitHub installation
   - No way to enforce per-user installation isolation

### Security Impact

- User B could see User A's repositories
- User B could create sites using User A's GitHub installations
- User B could potentially access User A's private repositories through the app
- Complete lack of user isolation for GitHub App installations

## The Fix

### 1. Created `github_installations` Table

**Migration:** `create_github_installations_table`

```sql
CREATE TABLE public.github_installations (
  id BIGINT PRIMARY KEY,              -- GitHub installation ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
```

**RLS Policies:**
- Users can only view their own installations
- Only service role can insert/update installations

### 2. Updated `github-installation-details` Function

**Changes:**
- Now records installations when users connect their GitHub account
- Upserts to `github_installations` table with user_id
- Links the installation to the authenticated user

**Code:**
```typescript
// Record this installation for the user
const { error: upsertError } = await supabaseClient
  .from('github_installations')
  .upsert({
    id: installation_id,
    user_id: user.id,
    account_login: installationData.account.login,
    account_type: installationData.account.type,
    account_avatar_url: installationData.account.avatar_url,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'id,user_id'
  })
```

### 3. Updated `list-github-installations` Function

**Changes:**
- First queries `github_installations` table filtered by user_id
- Only returns installations owned by the authenticated user
- Returns empty array if user has no installations

**Before:**
```typescript
// Use app-level authentication to list all installations
const { data: installations } = await app.octokit.request('GET /app/installations')
```

**After:**
```typescript
// Get installations owned by this user from the database
const { data: userInstallations, error: dbError } = await supabaseClient
  .from('github_installations')
  .select('*')
  .eq('user_id', user.id)
```

### 4. Updated `create-site` Function

**Changes:**
- Verifies the user owns the installation before creating a site
- Prevents users from manually specifying another user's installation_id

**Code:**
```typescript
// Verify the user owns this GitHub installation
const { data: installation, error: installationError } = await supabaseClient
  .from('github_installations')
  .select('id')
  .eq('id', parseInt(github_installation_id))
  .eq('user_id', user.id)
  .single()

if (installationError || !installation) {
  throw new Error('GitHub installation not found or not owned by user. Please connect your GitHub account first.')
}
```

## Security Verification

### What's Now Protected

1. ✅ Users can only see their own GitHub installations
2. ✅ Users can only create sites using their own installations
3. ✅ Database-level isolation via RLS policies
4. ✅ Application-level validation in edge functions
5. ✅ Installation ownership tracked in database

### Remaining Secure Pathways

Other edge functions that use `site.github_installation_id` are secure because:
- The installation_id comes from the site record, not user input
- Sites are protected by RLS policies (only site members can access)
- The installation was verified as owned by the creator when the site was created

## Testing Recommendations

1. **Test as User A:**
   - Install GitHub App
   - Verify installations appear in "Fetch Repositories"

2. **Test as User B (different account):**
   - Try to fetch repositories
   - Verify User B CANNOT see User A's installations
   - Verify User B sees only their own installations (or empty list)

3. **Test Installation Creation:**
   - Both users should be able to install the app independently
   - Each should only see their own installations

4. **Test Site Creation:**
   - User A should be able to create sites with their installations
   - User B should NOT be able to manually specify User A's installation_id
   - Should receive error: "GitHub installation not found or not owned by user"

## Deployment Notes

1. **Migration must run first** - Apply the `create_github_installations_table` migration
2. **Existing installations** - Users will need to reconnect their GitHub accounts to populate the new table
3. **No data loss** - Existing sites will continue to work (installation_id is still in sites table)
4. **Edge functions** - Deploy all updated edge functions after migration

## Files Modified

- `supabase/functions/github-installation-details/index.ts`
- `supabase/functions/list-github-installations/index.ts`
- `supabase/functions/create-site/index.ts`
- Migration: `create_github_installations_table`


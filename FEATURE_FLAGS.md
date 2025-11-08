# Feature Flags System

This project now includes a complete feature flag system built on top of Supabase. It's completely free and integrated with your existing infrastructure.

## Features

- ✅ Create, read, update, and delete feature flags
- ✅ Real-time updates across all clients
- ✅ Percentage-based rollouts (0-100%)
- ✅ User targeting support (ready for extension)
- ✅ Admin UI for managing flags
- ✅ React Context API for easy access
- ✅ TypeScript support

## How to Use Feature Flags in Your Code

### Basic Usage

```tsx
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

function MyComponent() {
  const { isEnabled } = useFeatureFlags();

  return (
    <div>
      {isEnabled('new_dashboard') && (
        <div>This is the new dashboard feature!</div>
      )}
      
      {isEnabled('beta_features') ? (
        <BetaFeatureComponent />
      ) : (
        <RegularFeatureComponent />
      )}
    </div>
  );
}
```

### Accessing All Flags

```tsx
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

function DebugPanel() {
  const { flags, isLoading } = useFeatureFlags();

  if (isLoading) return <div>Loading flags...</div>;

  return (
    <div>
      {Object.entries(flags).map(([key, flag]) => (
        <div key={key}>
          {flag.name}: {flag.enabled ? 'ON' : 'OFF'}
        </div>
      ))}
    </div>
  );
}
```

### Manually Refreshing Flags

```tsx
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

function AdminPanel() {
  const { refreshFlags } = useFeatureFlags();

  const handleRefresh = async () => {
    await refreshFlags();
    console.log('Flags refreshed!');
  };

  return <button onClick={handleRefresh}>Refresh Flags</button>;
}
```

## Managing Feature Flags

### Admin Interface

Admins can manage feature flags through the Settings page (`/settings`):

1. Navigate to `/settings` (admin access required)
2. Scroll to the "Feature Flags" section
3. Create, edit, or delete feature flags
4. Toggle flags on/off with the switch
5. Adjust rollout percentages

### Database Structure

The feature flags are stored in the `feature_flags` table with the following schema:

```sql
- id: UUID (primary key)
- flag_key: TEXT (unique identifier used in code)
- name: TEXT (display name)
- description: TEXT (optional description)
- enabled: BOOLEAN (whether the flag is active)
- rollout_percentage: INTEGER (0-100, percentage of users who see the feature)
- user_targeting: JSONB (for future user-specific targeting)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## Migration

The migration file is located at:
```
supabase/migrations/20251107130000_create_feature_flags_table.sql
```

To apply it to your Supabase instance, run:
```bash
supabase db push
```

Or if you're using the Supabase CLI in production:
```bash
supabase db push --linked
```

## Rollout Strategy

### Percentage-Based Rollout

Set the `rollout_percentage` to control how many users see the feature:

- `0%` - No users see the feature (even if enabled=true)
- `50%` - Approximately half of users see the feature
- `100%` - All users see the feature (default)

The implementation uses a **deterministic hash-based approach** combining the flag key and user ID. This ensures:
- Each user gets a consistent experience per flag (same user always sees the same result)
- Different users see different results based on the rollout percentage
- The distribution is approximately uniform across users
- Users not logged in will not see features with rollout < 100%

**How it works:**
1. Creates a hash from `flagKey + userId`
2. Converts hash to a threshold value (0-99)
3. Compares threshold to rollout percentage
4. User sees feature if threshold < rollout_percentage

Example: With 30% rollout, approximately 30% of users will see the feature consistently.

### User Targeting (Whitelist/Blacklist)

You can explicitly include or exclude specific users from seeing a feature flag, regardless of the rollout percentage. This is useful for:
- Beta testing with specific users
- Blocking problematic users from new features
- Giving early access to VIP users or team members

**Priority Order:**
1. **Blacklist** - If a user is blacklisted, they will NEVER see the feature (highest priority)
2. **Whitelist** - If a user is whitelisted, they will ALWAYS see the feature (overrides rollout percentage)
3. **Rollout Percentage** - If user is not in whitelist/blacklist, normal rollout percentage applies

**In the Admin UI:**
- Use the email search to find and add users
- Type an email address to search
- Select users from the dropdown
- Selected users appear as badges showing their email
- Click the X on a badge to remove a user
- No need to manually copy/paste user IDs!
- **Users cannot be in both whitelist and blacklist** - if a user is in one list, they'll appear disabled in the other list's search with a label indicating which list they're already in

**Using the `user_targeting` field programmatically:**

```json
{
  "whitelist": ["user-id-1", "user-id-2"],
  "blacklist": ["user-id-3", "user-id-4"]
}
```

**Example scenarios:**

1. **Beta testers** - Set rollout to 0%, search for beta testers by email and add to whitelist
2. **Gradual rollout with VIPs** - Set rollout to 10%, search for VIP users and add to whitelist
3. **Block specific users** - Keep rollout at 100%, search for problematic users and add to blacklist

The `user_targeting` field (JSONB) can also be extended for more advanced targeting:

```json
{
  "userIds": ["user-id-1", "user-id-2"],
  "emails": ["user@example.com"],
  "attributes": {
    "plan": "premium",
    "region": "us-west"
  }
}
```

You can extend the `isEnabled` function to check this field and implement your custom targeting logic.

## Best Practices

1. **Naming Convention**: Use snake_case for `flag_key` (e.g., `new_dashboard`, `beta_feature`)
2. **Clean Up**: Remove feature flags after features are fully rolled out
3. **Documentation**: Keep flag descriptions up to date
4. **Testing**: Test both enabled and disabled states
5. **Gradual Rollout**: Start with low percentages and gradually increase

## Real-time Updates

The system automatically subscribes to Supabase real-time changes. When you update a flag in the admin UI, all connected clients will receive the update within seconds without requiring a page refresh.

## Security

- Feature flags are readable by all authenticated users
- Only authenticated users can manage flags (you may want to restrict this to admins only)
- The RLS policies are defined in the migration file

To restrict management to admins only, update the RLS policy in the migration or via Supabase dashboard.

## Examples

### Gradual Feature Rollout

```tsx
// Start with 10% of users
// In Settings, set rollout_percentage = 10

// After monitoring, increase to 50%
// In Settings, update rollout_percentage = 50

// Finally, enable for everyone
// In Settings, update rollout_percentage = 100
```

### A/B Testing

```tsx
function MyComponent() {
  const { isEnabled } = useFeatureFlags();

  if (isEnabled('variant_a')) {
    return <VariantA />;
  }
  return <VariantB />;
}
```

### Beta Features

```tsx
function BetaFeatureAccess() {
  const { isEnabled } = useFeatureFlags();

  if (!isEnabled('beta_features')) {
    return <div>This feature is not available yet.</div>;
  }

  return <BetaFeatureContent />;
}
```

### Whitelist/Blacklist Examples

```tsx
// Example 1: Beta testing with specific users
// In Settings: Set 'beta_editor' rollout to 0%, add tester user IDs to whitelist
function EditorPage() {
  const { isEnabled } = useFeatureFlags();
  
  if (isEnabled('beta_editor')) {
    return <BetaEditor />; // Only whitelisted users see this
  }
  return <OldEditor />;
}

// Example 2: Gradual rollout with VIP early access
// In Settings: Set 'new_feature' rollout to 25%, add VIP user IDs to whitelist
function Dashboard() {
  const { isEnabled } = useFeatureFlags();
  
  // VIPs always see it, plus 25% of other users
  if (isEnabled('new_feature')) {
    return <NewDashboard />;
  }
  return <OldDashboard />;
}

// Example 3: Block problematic users from resource-intensive feature
// In Settings: Set 'ai_assistant' enabled, add blocked user IDs to blacklist
function ChatPage() {
  const { isEnabled } = useFeatureFlags();
  
  // Blacklisted users never see this, even if enabled
  if (isEnabled('ai_assistant')) {
    return <AIChat />;
  }
  return <BasicChat />;
}
```

## Troubleshooting

### Flags not loading

1. Check that the migration has been applied
2. Verify the user is authenticated
3. Check browser console for errors
4. Verify Supabase connection

### Real-time updates not working

1. Check that Supabase Realtime is enabled in your project
2. Verify the `feature_flags` table has Realtime enabled
3. Check network tab for WebSocket connection

### Permission errors

1. Verify RLS policies are correctly applied
2. Check that the user is authenticated
3. For admin actions, verify user has admin role

## Future Enhancements

Consider adding:
- User-specific targeting based on user ID
- Environment-specific flags (dev/staging/prod)
- Flag change history/audit log
- Analytics integration
- Scheduled flag changes
- Flag dependencies (flag A requires flag B)

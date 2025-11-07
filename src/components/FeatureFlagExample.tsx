/**
 * Example component demonstrating how to use feature flags
 * 
 * This is a reference implementation showing different ways to use the
 * feature flag system. You can delete this file once you're familiar with the API.
 */

import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function FeatureFlagExample() {
  const { isEnabled, flags, isLoading, refreshFlags } = useFeatureFlags();

  if (isLoading) {
    return <div>Loading feature flags...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Feature Flag Examples</CardTitle>
          <CardDescription>
            This component demonstrates how to use feature flags in your app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Example 1: Simple conditional rendering */}
          <div>
            <h3 className="font-semibold mb-2">Example 1: Simple Conditional</h3>
            {isEnabled('new_dashboard') ? (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded">
                ✅ New Dashboard is enabled!
              </div>
            ) : (
              <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded">
                ❌ New Dashboard is disabled
              </div>
            )}
          </div>

          {/* Example 2: Feature gate */}
          <div>
            <h3 className="font-semibold mb-2">Example 2: Feature Gate</h3>
            {isEnabled('beta_features') && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded">
                <Badge className="mb-2">Beta</Badge>
                <p>This beta feature is only visible when the flag is enabled!</p>
              </div>
            )}
            {!isEnabled('beta_features') && (
              <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded">
                Beta features are not available
              </div>
            )}
          </div>

          {/* Example 3: Multiple flags */}
          <div>
            <h3 className="font-semibold mb-2">Example 3: Multiple Flags</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(flags).map(([key, flag]) => (
                <Badge
                  key={key}
                  variant={flag.enabled ? 'default' : 'outline'}
                >
                  {flag.name}: {flag.enabled ? 'ON' : 'OFF'}
                </Badge>
              ))}
            </div>
          </div>

          {/* Example 4: Programmatic refresh */}
          <div>
            <h3 className="font-semibold mb-2">Example 4: Refresh Flags</h3>
            <Button onClick={() => refreshFlags()} variant="outline">
              Refresh Feature Flags
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Flags auto-update in real-time, but you can manually refresh if needed
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage in Your Code</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
            <code>{`import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

function MyComponent() {
  const { isEnabled } = useFeatureFlags();

  return (
    <div>
      {isEnabled('my_feature_flag') && (
        <div>Feature content here</div>
      )}
    </div>
  );
}`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

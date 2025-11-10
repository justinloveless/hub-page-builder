# Over-The-Air (OTA) Updates Guide

This guide explains how updates work in your Capacitor-wrapped PWA and how to enable OTA updates.

## Current Setup: Bundled Assets

**How it works now:**
- Web assets (HTML, CSS, JS) are copied from `dist/` into the native apps during `cap sync`
- These assets are bundled with the app binary
- Users get the version that was submitted to the app stores
- **To update**: You must publish a new version through Apple/Google

**Pros:**
- ✅ App works offline immediately
- ✅ Faster initial load (no network request)
- ✅ No external dependencies
- ✅ Complies with app store policies

**Cons:**
- ❌ Requires app store review for every update
- ❌ Users must download new version
- ❌ Slower iteration cycle

## Enabling OTA Updates

You have several options to enable OTA updates for your web content:

### Option 1: Capacitor Live Updates (Recommended)

Use a service designed for this purpose:

**Ionic Appflow (Official)**
- https://ionic.io/appflow
- Handles OTA updates automatically
- Includes version management
- Provides rollback capability
- Paid service with free tier

**Setup:**
```bash
npm install @ionic/live-updates
# Follow Appflow setup wizard
```

### Option 2: Remote URL Configuration

Configure Capacitor to load from a remote URL instead of bundled assets.

#### Step 1: Update `capacitor.config.ts`

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.staticsnack.app',
  appName: 'StaticSnack',
  webDir: 'dist',
  server: {
    url: 'https://your-production-url.com', // Your live website
    cleartext: true,
    androidScheme: 'https'
  },
  // ... rest of config
};

export default config;
```

**⚠️ Important:**
- Only use this during development/testing
- For production, use Option 3 (Hybrid Approach)
- App stores may reject apps that are just website wrappers

#### Step 2: Test

```bash
npm run cap:sync
# Open in Xcode/Android Studio and test
```

**Pros:**
- ✅ Instant updates (no app store review)
- ✅ Update all users immediately
- ✅ Fast iteration

**Cons:**
- ❌ Requires internet connection to work
- ❌ May violate app store policies if app is just a wrapper
- ❌ Slower initial load
- ❌ No offline support initially

### Option 3: Hybrid Approach (Best Practice)

Bundle assets for offline use but check for updates from your server.

#### Implementation

**1. Create an update checker service:**

```typescript
// src/services/updateService.ts
export class UpdateService {
  private static readonly VERSION_CHECK_URL = 'https://your-api.com/app-version';
  private static readonly CURRENT_VERSION = '1.0.0'; // From package.json

  static async checkForUpdates(): Promise<boolean> {
    try {
      const response = await fetch(this.VERSION_CHECK_URL);
      const { latestVersion, forceUpdate } = await response.json();
      
      if (this.isNewerVersion(latestVersion, this.CURRENT_VERSION)) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  }

  private static isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }
    return false;
  }

  static async downloadUpdate(): Promise<void> {
    // Force reload from server
    window.location.reload();
  }
}
```

**2. Add update check to your app:**

```typescript
// src/App.tsx or main.tsx
import { UpdateService } from './services/updateService';
import { useEffect, useState } from 'react';

function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check for updates on app launch
    UpdateService.checkForUpdates().then(setUpdateAvailable);
    
    // Check periodically (every 30 minutes)
    const interval = setInterval(() => {
      UpdateService.checkForUpdates().then(setUpdateAvailable);
    }, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    UpdateService.downloadUpdate();
  };

  return (
    <>
      {updateAvailable && (
        <UpdateBanner onUpdate={handleUpdate} />
      )}
      {/* Rest of your app */}
    </>
  );
}
```

**3. Leverage your existing service worker:**

Your app already has a service worker from `vite-plugin-pwa`. You can enhance it:

```typescript
// vite.config.ts - update workbox configuration
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    // ... existing config
    runtimeCaching: [
      {
        urlPattern: ({ url }) => {
          return url.origin === self.location.origin;
        },
        handler: 'NetworkFirst', // Try network first, fallback to cache
        options: {
          cacheName: 'app-shell',
          expiration: {
            maxAgeSeconds: 24 * 60 * 60 // 24 hours
          }
        }
      },
      // ... existing runtime caching
    ]
  }
})
```

**4. Backend endpoint for version checking:**

Create an endpoint that returns current version:

```json
// GET https://your-api.com/app-version
{
  "latestVersion": "1.0.1",
  "forceUpdate": false,
  "updateMessage": "New features and bug fixes available"
}
```

**Pros:**
- ✅ Works offline (bundled assets)
- ✅ Can deliver updates for web content
- ✅ User decides when to update
- ✅ App store compliant (provides value beyond wrapper)
- ✅ Graceful degradation

**Cons:**
- ⚠️ Requires backend endpoint
- ⚠️ More complex implementation
- ⚠️ Updates not truly "automatic"

### Option 4: Capacitor's built-in update capabilities

Use Capacitor's built-in support for checking updates:

```bash
npm install @capacitor/app
```

```typescript
import { App } from '@capacitor/app';

// Listen for app state changes
App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    // Check for updates when app becomes active
    checkAndApplyUpdates();
  }
});

async function checkAndApplyUpdates() {
  // Your update logic here
  // Could use service worker's update mechanism
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      if (registration.waiting) {
        // New service worker is waiting
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }
  }
}
```

## What Can Be Updated OTA vs. Requires Store Submission

### ✅ Can Update OTA (Web Content)
- HTML, CSS, JavaScript changes
- UI/UX improvements
- Bug fixes in web code
- New features in web code
- Content updates
- API endpoint changes
- Third-party library updates (if web-based)

### ❌ Requires Store Submission (Native)
- Capacitor plugins added/updated
- Native code changes (iOS/Android)
- Permissions changes (new permissions needed)
- App icon changes
- App name changes
- capacitor.config.ts changes affecting native layer
- Minimum OS version changes
- Build configuration changes

## App Store Policy Compliance

### Apple App Store
**3.2.2 Acceptable Updates:**
- Allowed: Updates to HTML, CSS, and JavaScript
- Allowed: Bug fixes and improvements
- **NOT Allowed**: Changing app's core purpose/functionality significantly
- **NOT Allowed**: Bypassing review for features that would require approval

**Best Practice:**
- Use OTA for minor updates, improvements, bug fixes
- Submit to store for major feature changes
- Always provide bundled assets (don't rely 100% on remote)

### Google Play Store
**More lenient than Apple:**
- Generally allows more flexible update mechanisms
- Still requires app to function without network
- Must not be deceptive about app functionality

## Recommended Approach

For StaticSnack, I recommend **Option 3: Hybrid Approach**

**Why:**
1. Your app provides real value (GitHub Pages management)
2. Bundled assets ensure offline functionality
3. Service worker already in place
4. Can iterate quickly on web features
5. Complies with app store policies
6. Best user experience

**Implementation Steps:**

1. **Keep current setup** (bundled assets)
2. **Add update checker** (as shown in Option 3)
3. **Use NetworkFirst caching strategy** for your domain
4. **Leverage existing service worker** from vite-plugin-pwa
5. **Create version endpoint** on your backend
6. **Show update prompt** to users when new version available
7. **Store submission** only for native changes

## Testing OTA Updates

### Test Checklist
1. **Install production build** on device
2. **Deploy new web version** to your server
3. **Update version endpoint** with new version number
4. **Open app** - should detect update
5. **Accept update** - should reload with new content
6. **Go offline** - should still work with bundled assets
7. **Clear cache** - should re-download latest

### Testing Script

```bash
# 1. Build and deploy initial version
npm run build
npm run cap:sync
# Install on device

# 2. Make changes to web code
# Edit version in package.json: 1.0.0 -> 1.0.1

# 3. Build and deploy new version
npm run build
# Deploy dist/ to your hosting (but don't cap sync yet)

# 4. Open app on device
# Should detect update and prompt user

# 5. After update works, sync for next app store version
npm run cap:sync
```

## Monitoring Updates

Track update adoption:

```typescript
// Analytics example
import { analytics } from './analytics';

UpdateService.checkForUpdates().then(available => {
  if (available) {
    analytics.track('update_available', {
      currentVersion: CURRENT_VERSION,
      availableVersion: latestVersion
    });
  }
});

UpdateService.downloadUpdate().then(() => {
  analytics.track('update_installed', {
    version: latestVersion
  });
});
```

## Troubleshooting

### Update not detected
- Check service worker is registered
- Verify version endpoint is accessible
- Check browser cache settings
- Ensure NetworkFirst strategy is configured

### App crashes after update
- Test thoroughly before deploying
- Implement rollback mechanism
- Keep at least one version back cached
- Add error boundaries in React

### Slow update download
- Optimize bundle size
- Use code splitting
- Implement progressive updates
- Show progress indicator

## Summary

**For Production:**
- Bundle assets for offline support (current setup ✅)
- Add update checker for web content updates
- Use NetworkFirst caching strategy
- Show update prompts to users
- Submit to stores for native changes only

**Update Frequency:**
- Web updates: As often as needed (instant)
- Store updates: Only when changing native code (monthly/quarterly)

This gives you the best of both worlds: fast iteration + app store compliance + offline support!

## Resources

- [Capacitor Live Updates](https://capacitorjs.com/docs/guides/live-updates)
- [Ionic Appflow](https://ionic.io/appflow)
- [PWA Update Patterns](https://web.dev/service-worker-lifecycle/)
- [App Store Review Guidelines 3.2.2](https://developer.apple.com/app-store/review/guidelines/#unacceptable)

## Example: Complete Update Flow

```typescript
// 1. User opens app
// 2. App checks for updates in background
// 3. If update available:
//    - Show banner: "Update available"
//    - User clicks "Update"
//    - Service worker fetches new assets
//    - App reloads with new content
// 4. If no internet:
//    - App uses bundled assets
//    - Works offline perfectly
// 5. Next time online:
//    - Checks again and updates
```

This approach keeps users happy with fast updates while keeping Apple and Google happy with app store compliance! 🚀

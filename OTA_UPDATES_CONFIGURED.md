# OTA Updates - CONFIGURED ✅

Your app is now configured for **automatic over-the-air (OTA) updates**!

## How It Works

When you deploy a new version of your web app, mobile users will automatically get the update **without needing to download from the app store**.

### Update Flow

```
1. User opens app → Uses bundled assets (works offline)
2. App checks for updates in background
3. New version found → Downloads automatically
4. Update installed → App reloads with new version
5. User sees updated content immediately
```

## What's Configured

### ✅ 1. Service Worker (vite-plugin-pwa)
- **NetworkFirst** caching strategy
- Checks network for updates before using cache
- Automatically downloads and caches new versions
- `skipWaiting: true` - New version activates immediately
- `clientsClaim: true` - Takes control of all pages immediately

### ✅ 2. Update Service (`src/services/updateService.ts`)
- Initializes on app startup
- Checks for updates every 5 minutes
- Checks when app comes to foreground
- Automatically applies updates without user action
- Logs all update activity to console

### ✅ 3. Capacitor App Plugin
- Monitors app lifecycle (resume/pause)
- Triggers update checks when app becomes active
- Works on both iOS and Android

### ✅ 4. App.tsx Integration
- Initializes UpdateService on mount
- Sets up Capacitor listeners
- Handles cleanup on unmount

## Deployment Workflow

### 1. Deploy Web Updates (Instant)

```bash
# Make your code changes
# Commit your changes

# Build for production
npm run build

# Deploy dist/ folder to your web hosting
# (Netlify, Vercel, your own server, etc.)
```

**That's it!** Mobile users will automatically get the update next time they:
- Open the app (checks immediately)
- Use the app (checks every 5 minutes)
- Return to the app from background (checks on resume)

### 2. Native Updates (Requires App Store)

Only needed when you change:
- Capacitor plugins
- Native code (iOS/Android)
- Permissions
- App configuration

```bash
# Build and sync to native
npm run build
npx cap sync

# Then submit to app stores
npm run cap:build:ios      # For iOS
npm run cap:build:android  # For Android
```

## What Can Be Updated OTA

### ✅ Instant Updates (No App Store)
- UI/UX changes
- Bug fixes
- New web features
- Content updates
- CSS/styling changes
- JavaScript logic changes
- API endpoint changes
- Third-party web libraries

### ❌ Requires App Store Submission
- New Capacitor plugins
- Native code changes
- Permission changes
- App icon/name changes
- Capacitor config changes (native layer)

## Testing OTA Updates

### Test Locally

1. **Install current version on device:**
   ```bash
   npm run build
   npm run cap:sync
   # Open in Xcode/Android Studio and install
   ```

2. **Make a visible change:**
   ```typescript
   // Example: Change a button color or text
   <Button>Version 2.0 - Updated!</Button>
   ```

3. **Deploy new version:**
   ```bash
   npm run build
   # Deploy dist/ to your hosting
   # (Don't run cap:sync - we're testing OTA!)
   ```

4. **Open app on device:**
   - App should check for updates automatically
   - Wait ~10 seconds (for background check)
   - App should reload automatically with new content
   - Check console logs for update activity

### Verify Update

Check browser console (in web) or device logs (in native) for:
```
[UpdateService] Initializing...
[UpdateService] Periodic update check...
[UpdateService] Update found! Activating...
[UpdateService] New service worker activated, reloading...
```

## Monitoring Updates

### Console Logs

The UpdateService logs all activity:
- `Initializing...` - Service started
- `Periodic update check...` - Background check (every 5 minutes)
- `Update found! Activating...` - New version detected
- `New service worker activated, reloading...` - Update applied

### Check Update Status Programmatically

```typescript
import { UpdateService } from '@/services/updateService';

// Get current update status
const status = await UpdateService.getUpdateStatus();
console.log(status);
// {
//   hasServiceWorker: true,
//   hasUpdate: false,
//   isInstalling: false,
//   version: "https://yourapp.com/sw.js"
// }
```

## Troubleshooting

### Update Not Detecting

**Problem:** Changes deployed but app doesn't update

**Solutions:**
1. Check service worker is registered:
   ```javascript
   navigator.serviceWorker.getRegistration()
   ```

2. Check network requests in DevTools (should see requests to your domain)

3. Verify NetworkFirst is working:
   - Open Network tab in DevTools
   - Should see network requests (not all from cache)

4. Force update check:
   ```javascript
   UpdateService.checkForUpdates()
   ```

### Cache Issues

**Problem:** Old content still showing

**Solutions:**
1. Clear app cache (nuclear option):
   ```javascript
   UpdateService.clearCaches()
   window.location.reload()
   ```

2. Uninstall and reinstall app

3. Check cache strategy in vite.config.ts

### Update Taking Too Long

**Problem:** Updates take forever to download

**Solutions:**
1. Optimize bundle size:
   ```bash
   npm run build -- --mode production
   # Check dist/ folder size
   ```

2. Use code splitting:
   ```typescript
   // Lazy load routes
   const Dashboard = lazy(() => import('./pages/Dashboard'));
   ```

3. Check network speed (updates download in background)

## Configuration Options

### Change Update Check Frequency

Edit `src/services/updateService.ts`:

```typescript
// Currently: Every 5 minutes
this.updateCheckInterval = setInterval(() => {
  this.checkForUpdates();
}, 5 * 60 * 1000); // Change this value
```

Examples:
- `1 * 60 * 1000` - Every 1 minute (aggressive)
- `10 * 60 * 1000` - Every 10 minutes (moderate)
- `30 * 60 * 1000` - Every 30 minutes (conservative)

### Manual Updates Only

If you want users to control updates:

```typescript
// In vite.config.ts, change:
registerType: 'prompt'  // Shows update prompt

// Then in your app, listen for prompt:
window.addEventListener('vite-plugin-pwa:update', (e) => {
  if (confirm('New version available. Update now?')) {
    e.detail.activate();
  }
});
```

## Best Practices

### 1. **Always Test Before Deploying**
- Test locally first
- Deploy to staging environment
- Test on real devices
- Then deploy to production

### 2. **Version Your Deployments**
- Use semantic versioning (1.0.0, 1.0.1, etc.)
- Tag releases in git
- Keep deployment logs

### 3. **Monitor Updates**
- Set up analytics to track update adoption
- Monitor error rates after updates
- Have rollback plan ready

### 4. **Gradual Rollouts**
- Deploy to small percentage first
- Monitor for issues
- Gradually increase percentage

### 5. **Communicate Changes**
- Keep changelog updated
- Notify users of major changes
- Provide release notes

## App Store Compliance

### ✅ This Configuration is Compliant

**Why:**
- App provides real value (GitHub Pages management)
- Bundled assets ensure offline functionality
- Updates enhance existing features (not change core purpose)
- Complies with Apple's 3.2.2 guidelines
- Complies with Google Play policies

**Acceptable Updates:**
- Bug fixes and improvements
- New features in same category
- UI/UX enhancements
- Performance improvements

**Not Acceptable:**
- Completely changing app purpose
- Adding features that require new permissions
- Bypassing app store review for restricted features

## Example: Complete Workflow

### Week 1: Ship Initial Version
```bash
npm run build
npm run cap:sync
# Submit to app stores
```

### Week 2: Bug Fix
```bash
# Fix bugs in code
npm run build
# Deploy to hosting
# ✅ Users auto-update (no app store needed)
```

### Week 3: New Web Feature
```bash
# Add new feature
npm run build
# Deploy to hosting
# ✅ Users auto-update (no app store needed)
```

### Week 4: Add New Permission
```bash
# Update Capacitor config
npm run build
npm run cap:sync
# ❌ Must submit to app stores
```

## Summary

🎉 **Your app now has automatic OTA updates!**

- ✅ Web changes deploy instantly
- ✅ Users auto-update (no action needed)
- ✅ Works offline (bundled assets)
- ✅ App store compliant
- ✅ Checks every 5 minutes + on app resume
- ✅ Logs all activity for debugging

**Deploy web changes anytime** - users get them automatically within 5 minutes!

**Only submit to app stores** when changing native code or permissions.

---

## Quick Reference

```bash
# Regular updates (instant OTA)
npm run build
# Deploy dist/ folder

# Native updates (app store submission)
npm run build
npm run cap:sync
npm run cap:build:ios
npm run cap:build:android
```

**Questions?** Check the console logs for update activity!

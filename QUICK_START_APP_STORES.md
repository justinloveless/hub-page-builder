# Quick Start: App Store Submission

Quick reference for building and submitting StaticSnack to app stores.

## Prerequisites Checklist

- [ ] Apple Developer Account ($99/year) for iOS
- [ ] Google Play Developer Account ($25 one-time) for Android
- [ ] Privacy Policy URL (REQUIRED for both stores)
- [ ] Support URL/Email
- [ ] App screenshots for multiple device sizes

## Build Commands

### iOS App Store

```bash
# 1. Build and open iOS project
npm run cap:build:ios

# 2. In Xcode:
#    - Set signing team
#    - Archive (Product -> Archive)
#    - Upload to App Store Connect
```

### Google Play Store

```bash
# 1. Build and open Android project
npm run cap:build:android

# 2. In Android Studio:
#    - Configure signing (see APP_STORE_SUBMISSION.md)
#    - Build AAB: ./gradlew bundleRelease
#    - Upload AAB to Play Console
```

## Quick Links

- [Full Submission Guide](./APP_STORE_SUBMISSION.md)
- [Apple Developer Portal](https://developer.apple.com/)
- [Google Play Console](https://play.google.com/console/)
- [App Store Connect](https://appstoreconnect.apple.com/)

## Common Commands

```bash
# Build web app
npm run build

# Sync to native projects
npm run cap:sync

# Open native IDEs
npm run cap:open:ios
npm run cap:open:android

# Regenerate icons/splash screens
npm run assets:generate
```

## Required App Store Assets

### Screenshots Needed
- **iOS**: Multiple iPhone sizes (6.7", 6.5", 5.5") + iPad
- **Android**: Phone (at least 2) + Tablet (at least 2)

### Metadata Required
- App Name: **StaticSnack**
- Short Description: Manage your GitHub Pages sites with ease
- Full Description: (see index.html for current description)
- Category: Developer Tools / Productivity
- Keywords: static sites, GitHub Pages, web development
- **Privacy Policy URL** (REQUIRED - must be live URL)
- Support URL/Email
- Marketing URL (optional)

### Graphics
- App Icon: ✅ Already configured (512x512)
- Feature Graphic (Android): 1024x500 (needs creation)
- Screenshots: Multiple sizes (see full guide)

## Before Submitting

- [ ] Test on physical devices (iOS and Android)
- [ ] Verify all app features work in production build
- [ ] Privacy policy is published and accessible
- [ ] All screenshots are captured
- [ ] App metadata is complete
- [ ] Version numbers are set correctly
- [ ] Signing is configured properly

## After Approval

1. Monitor reviews and ratings
2. Respond to user feedback
3. Plan regular updates
4. Set up analytics and crash reporting
5. Market your app

## Need Help?

See the detailed [APP_STORE_SUBMISSION.md](./APP_STORE_SUBMISSION.md) guide for:
- Step-by-step instructions
- Troubleshooting common issues
- Screenshots requirements
- Signing configuration
- Update process
- ASO tips

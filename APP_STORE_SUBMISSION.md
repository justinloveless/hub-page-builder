# App Store Submission Guide

This guide explains how to submit StaticSnack PWA to the Apple App Store and Google Play Store.

## Prerequisites

### For iOS App Store
- macOS computer with Xcode installed (latest version recommended)
- Apple Developer Account ($99/year)
- Valid code signing certificate and provisioning profile

### For Google Play Store
- Android Studio installed
- Google Play Developer Account ($25 one-time fee)
- Valid keystore for signing the app

## Project Setup

The project has been configured with Capacitor to wrap the PWA as a native app for both iOS and Android.

### Key Files
- `capacitor.config.ts` - Capacitor configuration
- `ios/` - iOS native project
- `android/` - Android native project
- `assets/` - Source assets for icon and splash screen generation

## Building for iOS (App Store)

### 1. Build and Sync the Web Assets

```bash
npm run cap:build:ios
```

This will:
1. Build the web app with Vite
2. Sync the web assets to the iOS project
3. Open the project in Xcode

### 2. Configure in Xcode

1. **Update Bundle Identifier**: Select the project in Xcode, go to "Signing & Capabilities" and ensure the Bundle Identifier matches your Apple Developer account (currently set to `com.staticsnack.app`)

2. **Configure Signing**: 
   - Select your Team from the dropdown
   - Ensure "Automatically manage signing" is checked
   - Verify the provisioning profile is correctly set

3. **Update Version and Build Numbers**:
   - Set Version to something like `1.0.0`
   - Set Build number to `1` (increment for each submission)

4. **Configure App Capabilities**:
   - Review required capabilities in "Signing & Capabilities"
   - Add any additional capabilities your app needs

### 3. Test on Simulator and Device

```bash
# Run on simulator
Product -> Run (or ⌘R)

# Run on physical device
Connect device -> Select device from target list -> Product -> Run
```

### 4. Archive and Upload

1. Select "Any iOS Device" as the target
2. Product -> Archive
3. Once archived, the Organizer will open
4. Select your archive -> "Distribute App"
5. Choose "App Store Connect"
6. Follow the wizard to upload your app

### 5. Submit for Review in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Create a new app if not already created
3. Fill in all required metadata:
   - App name: StaticSnack
   - Subtitle: GitHub Pages Site Manager
   - Description: (use the description from index.html)
   - Keywords: static sites, GitHub Pages, web development, site management
   - Screenshots (required for all device sizes)
   - App icon (already configured)
   - Privacy Policy URL (required)
   - Support URL

4. Select the build you just uploaded
5. Submit for review

## Building for Android (Google Play Store)

### 1. Build and Sync the Web Assets

```bash
npm run cap:build:android
```

This will:
1. Build the web app with Vite
2. Sync the web assets to the Android project
3. Open the project in Android Studio

### 2. Configure in Android Studio

1. **Update Application ID**: Open `android/app/build.gradle` and verify `applicationId "com.staticsnack.app"`

2. **Update Version**:
   - In `android/app/build.gradle`:
   ```gradle
   versionCode 1
   versionName "1.0.0"
   ```

3. **Generate Signing Key** (if not already done):
   ```bash
   keytool -genkey -v -keystore staticsnack-release-key.keystore -alias staticsnack -keyalg RSA -keysize 2048 -validity 10000
   ```
   Store this keystore file securely!

4. **Configure Signing** in `android/app/build.gradle`:
   ```gradle
   android {
       ...
       signingConfigs {
           release {
               storeFile file('path/to/staticsnack-release-key.keystore')
               storePassword 'your-store-password'
               keyAlias 'staticsnack'
               keyPassword 'your-key-password'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

### 3. Build Release APK/AAB

Build an Android App Bundle (AAB) - required for Play Store:

```bash
cd android
./gradlew bundleRelease
```

The AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

### 4. Test the Release Build

Before submitting, test the release build:

```bash
# Install on connected device
./gradlew installRelease
```

### 5. Submit to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. Create a new app
3. Fill in store listing:
   - App name: StaticSnack
   - Short description: Manage your GitHub Pages sites with ease
   - Full description: (use detailed description)
   - App icon: 512x512 (use `public/favicon.png`)
   - Feature graphic: 1024x500 (needs to be created)
   - Screenshots: At least 2 for phone, 1 for tablet
   - Category: Developer Tools
   - Privacy Policy URL (required)

4. Complete Content Rating questionnaire
5. Set up pricing (Free or Paid)
6. Upload your AAB file in the Production track
7. Submit for review

## Important Notes

### Privacy Policy
You MUST have a privacy policy URL. Since this app:
- Uses Supabase for authentication and data storage
- Integrates with GitHub
- May collect user data

Ensure your privacy policy covers:
- What data is collected
- How data is used
- How data is stored (Supabase)
- Third-party services (GitHub, Supabase)
- User rights (deletion, access, etc.)

### App Store Guidelines
- Apple: Review [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Google: Review [Google Play Developer Policy](https://play.google.com/about/developer-content-policy/)

### Testing Requirements
- **iOS**: Test on multiple device sizes (iPhone, iPad)
- **Android**: Test on various screen sizes and Android versions (minimum API level is in android/variables.gradle)

### Screenshots Requirements

**iOS:**
- iPhone 6.7": 1290 x 2796 pixels
- iPhone 6.5": 1242 x 2688 pixels
- iPhone 5.5": 1242 x 2208 pixels
- iPad Pro (6th Gen) 12.9": 2048 x 2732 pixels
- iPad Pro (2nd Gen) 12.9": 2048 x 2732 pixels

**Android:**
- Phone: At least 2 screenshots (320-3840 pixels on longer side)
- 7-inch tablet: At least 1 screenshot
- 10-inch tablet: At least 1 screenshot

## Continuous Updates

### Update Process

1. Update version in `package.json`
2. Build web assets: `npm run build`
3. Sync to native projects: `npx cap sync`

**For iOS:**
- Increment build number in Xcode
- Archive and upload new build
- Submit for review in App Store Connect

**For Android:**
- Increment `versionCode` and `versionName` in `build.gradle`
- Build new AAB: `./gradlew bundleRelease`
- Upload to Play Console
- Submit for review

## Helpful Commands

```bash
# Sync web code to native projects
npm run cap:sync

# Open iOS project in Xcode
npm run cap:open:ios

# Open Android project in Android Studio
npm run cap:open:android

# Build and open for iOS
npm run cap:build:ios

# Build and open for Android
npm run cap:build:android

# Regenerate icons and splash screens
npm run assets:generate
```

## Troubleshooting

### iOS Build Issues
- Clean build folder: Product -> Clean Build Folder (⇧⌘K)
- Delete DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- Update pods: `cd ios/App && pod install --repo-update`

### Android Build Issues
- Clean project: `cd android && ./gradlew clean`
- Invalidate caches: In Android Studio, File -> Invalidate Caches / Restart
- Update Gradle: Use Android Studio's update suggestions

### App Rejected?
- Review the rejection reasons carefully
- Common issues:
  - Missing privacy policy
  - Incomplete metadata
  - App crashes on launch
  - Missing required screenshots
  - Functionality issues
  - Permissions not explained

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Apple Developer Portal](https://developer.apple.com/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)
- [PWA to App Store Guide](https://capacitorjs.com/docs/guides/deploying-updates)

## Next Steps After Approval

1. **Monitor Analytics**: Use App Store Connect and Play Console analytics
2. **Respond to Reviews**: Engage with users through app reviews
3. **Plan Updates**: Regular updates keep users engaged
4. **Marketing**: Promote your app through various channels
5. **Support**: Provide support channels for users

## App Store Optimization (ASO)

Consider optimizing:
- **Keywords**: Research and use relevant keywords
- **Screenshots**: Show key features and benefits
- **App Preview Videos**: Add demo videos (iOS)
- **Icon**: Make it stand out
- **Description**: Clear, concise, benefit-focused

## Maintenance Checklist

- [ ] Set up automatic build/deployment pipeline
- [ ] Configure crash reporting (e.g., Sentry)
- [ ] Set up analytics (e.g., Firebase Analytics)
- [ ] Plan feature updates schedule
- [ ] Monitor app store reviews weekly
- [ ] Keep dependencies updated
- [ ] Test on new OS versions when released

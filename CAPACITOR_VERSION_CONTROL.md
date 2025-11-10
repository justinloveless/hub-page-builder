# Capacitor Version Control Guide

This document explains what Capacitor files should be committed to version control and why.

## Overview

The `ios/` and `android/` directories contain native mobile projects. Most of these files **should be committed** to version control, with specific exceptions for build artifacts and user-specific settings.

## What IS Committed ✅

### iOS Project
- `ios/App/` - Main iOS app structure
- `ios/App/App/` - App source files and assets
- `ios/App/App.xcodeproj/` - Xcode project configuration
- `ios/App/App.xcworkspace/` - Xcode workspace (excluding user data)
- `ios/App/Podfile` - CocoaPods dependency manifest
- `ios/App/Podfile.lock` - CocoaPods dependency lock file
- Generated app icons and splash screens in `ios/App/App/Assets.xcassets/`

### Android Project
- `android/app/` - Main Android app module
- `android/app/src/` - App source files and resources
- `android/app/build.gradle` - Module build configuration
- `android/build.gradle` - Project build configuration
- `android/settings.gradle` - Project settings
- `android/gradle/` - Gradle wrapper files
- `android/gradlew` and `android/gradlew.bat` - Gradle wrapper scripts
- `android/capacitor.settings.gradle` - Capacitor plugin configuration
- `android/variables.gradle` - Project variables
- Generated app icons and splash screens in `android/app/src/main/res/`

### Web Assets (Copied During Sync)
- `dist/` folder contents are copied to native projects during `cap sync`
- These are NOT committed in native projects (regenerated on sync)

## What is NOT Committed ❌

### iOS - Ignored Files
- `ios/App/Pods/` - CocoaPods dependencies (regenerated from Podfile)
- `ios/App/build/` - Build outputs
- `ios/App/App.xcworkspace/xcuserdata/` - User-specific IDE settings
- `ios/App/App.xcodeproj/xcuserdata/` - User-specific project settings
- `ios/App/App.xcodeproj/project.xcworkspace/xcuserdata/` - User-specific workspace data

### Android - Ignored Files
- `android/.gradle/` - Gradle cache
- `android/build/` - Build outputs
- `android/app/build/` - App module build outputs
- `android/.idea/` - Android Studio IDE settings
- `android/local.properties` - Local SDK paths (machine-specific)
- `android/*.iml` - IntelliJ/Android Studio module files
- `android/app/*.iml` - App module files

### Asset Sources
- `assets/` - Source files for icon/splash generation (already in `.gitignore`)
  - Keep your source assets elsewhere (design files, high-res originals)
  - Use `npm run assets:generate` to regenerate from source
  - The generated icons in native projects ARE committed

## Why This Matters

### ✅ Committing Native Projects
**Advantages:**
- Team members can immediately build for mobile
- Preserves custom native configurations
- No need to regenerate projects
- Faster onboarding

**When you should:**
- In most team development scenarios
- When you have custom native code or plugins
- When you want reproducible builds

### ❌ NOT Committing Native Projects (Alternative Approach)
**Some teams choose to NOT commit `ios/` and `android/`:**
- Keeps repo smaller
- Requires teammates to run `npx cap add ios && npx cap add android`
- Need to regenerate assets with `npm run assets:generate`
- More setup for new developers

**Our approach:** We commit native projects for easier team collaboration.

## Syncing Changes

### When Web Code Changes
```bash
# Rebuild web assets and sync to native projects
npm run build
npx cap sync
```

This updates:
- Web assets in `ios/App/App/public/`
- Web assets in `android/app/src/main/assets/public/`
- Capacitor config in native projects

### When Native Code Changes
Native code changes (in Xcode or Android Studio) are tracked directly:
- Changes to `Info.plist`, `build.gradle`, etc. are committed normally
- No special sync needed

### When capacitor.config.ts Changes
```bash
# Sync config to native projects
npx cap sync
```

## Best Practices

1. **After pulling changes:**
   ```bash
   npm install              # Update node dependencies
   npm run build            # Rebuild web assets
   npx cap sync            # Sync to native projects
   ```

2. **Before committing:**
   - Test on both iOS and Android if you changed shared code
   - Verify build succeeds on both platforms
   - Check that no build artifacts are staged (`.gitignore` should handle this)

3. **When adding/updating Capacitor plugins:**
   ```bash
   npm install @capacitor/plugin-name
   npx cap sync            # Sync plugin to native projects
   git add ios/ android/   # Commit plugin integration changes
   ```

4. **Asset regeneration:**
   - Only regenerate when source icon/splash changes
   - Run `npm run assets:generate` 
   - Commit the updated assets in `ios/` and `android/`

## Team Collaboration Tips

### For Team Members
1. Clone the repo
2. Run `npm install`
3. Run `npm run build`
4. Run `npx cap sync`
5. Open in Xcode/Android Studio and build

### For CI/CD
```bash
# Standard build pipeline
npm ci                    # Install dependencies
npm run build            # Build web assets
npx cap sync            # Sync to native platforms
# Then build with xcodebuild or gradle
```

## Troubleshooting

### "Native projects out of sync"
```bash
npm run build
npx cap sync
```

### "Pod install failed" (iOS)
```bash
cd ios/App
pod install --repo-update
```

### "Gradle sync failed" (Android)
```bash
cd android
./gradlew clean
./gradlew build
```

### "Missing native projects"
If you accidentally deleted `ios/` or `android/`:
```bash
npx cap add ios
npx cap add android
npm run assets:generate
npx cap sync
```

## Summary

✅ **DO commit:**
- Native project structure (`ios/`, `android/`)
- Generated icons and splash screens
- Native configuration files
- Plugin integration files

❌ **DON'T commit:**
- Build artifacts (`build/`, `.gradle/`)
- Dependencies (`Pods/`, `node_modules/`)
- User-specific IDE settings
- Local machine configuration (`local.properties`)
- Asset source files (`assets/`)

This ensures your team can build and run the app immediately after cloning, while keeping the repository clean and manageable.

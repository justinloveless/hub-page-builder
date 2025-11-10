# Pre-Submission Checklist

Use this checklist before submitting to app stores to ensure everything is ready.

## 📋 General Requirements

### Accounts & Access
- [ ] Apple Developer Account active ($99/year)
- [ ] Google Play Developer Account active ($25 one-time)
- [ ] Access to App Store Connect
- [ ] Access to Google Play Console

### Legal & Compliance
- [ ] Privacy Policy written and published at a public URL
- [ ] Terms of Service created (if applicable)
- [ ] Support email or URL established
- [ ] GDPR compliance reviewed (if targeting EU users)
- [ ] Age rating questionnaire completed

## 📱 iOS App Store Checklist

### Development Setup
- [ ] macOS computer with latest Xcode installed
- [ ] iOS signing certificate created
- [ ] Provisioning profile configured
- [ ] Bundle Identifier set: `com.staticsnack.app`

### App Configuration
- [ ] App version set in Xcode (e.g., 1.0.0)
- [ ] Build number set (starts at 1)
- [ ] Display name verified: "StaticSnack"
- [ ] Signing configured in Xcode
- [ ] App icons showing correctly in Xcode
- [ ] Splash screens configured

### Testing
- [ ] App runs on iOS Simulator
- [ ] App tested on physical iPhone
- [ ] App tested on physical iPad (if supporting iPad)
- [ ] All core features tested in production build
- [ ] No crashes on launch
- [ ] Network requests working
- [ ] Authentication flow working
- [ ] GitHub integration working
- [ ] Offline mode tested (PWA features)

### App Store Connect Setup
- [ ] App created in App Store Connect
- [ ] App name: "StaticSnack"
- [ ] Subtitle added
- [ ] Primary category: Developer Tools
- [ ] Secondary category: Productivity
- [ ] Keywords researched and added
- [ ] Full description written
- [ ] What's New text added
- [ ] Promotional text added (optional)
- [ ] Support URL added
- [ ] Marketing URL added (optional)
- [ ] Privacy Policy URL added (REQUIRED)

### Screenshots Required
- [ ] iPhone 6.7" (1290 x 2796) - at least 1
- [ ] iPhone 6.5" (1242 x 2688) - at least 1
- [ ] iPhone 5.5" (1242 x 2208) - at least 1
- [ ] iPad Pro 12.9" (2048 x 2732) - if supporting iPad
- [ ] Preview video created (optional, max 30 seconds)

### Pre-Archive
- [ ] Code signing works without errors
- [ ] No build warnings (or acceptable ones documented)
- [ ] Version incremented from previous version
- [ ] Release notes prepared
- [ ] Archive created successfully
- [ ] Archive uploaded to App Store Connect

### Submission
- [ ] Correct build selected in App Store Connect
- [ ] Export compliance questions answered
- [ ] Encryption usage declared
- [ ] Content rights confirmed
- [ ] Ready for review button enabled
- [ ] Submitted for review

## 🤖 Google Play Store Checklist

### Development Setup
- [ ] Android Studio installed
- [ ] Android SDK configured
- [ ] Release keystore created and secured
- [ ] Keystore password stored securely
- [ ] Signing configured in build.gradle

### App Configuration
- [ ] Application ID set: `com.staticsnack.app`
- [ ] Version Code set (starts at 1)
- [ ] Version Name set (e.g., 1.0.0)
- [ ] App name verified: "StaticSnack"
- [ ] Minimum SDK version appropriate
- [ ] Target SDK version is latest
- [ ] App icons showing correctly
- [ ] Splash screens configured

### Testing
- [ ] App runs on Android Emulator
- [ ] App tested on physical Android phone
- [ ] App tested on physical Android tablet (if supporting)
- [ ] Tested on multiple Android versions
- [ ] All core features tested in release build
- [ ] No crashes on launch
- [ ] Network requests working
- [ ] Authentication flow working
- [ ] GitHub integration working
- [ ] Offline mode tested (PWA features)
- [ ] ProGuard rules configured (if using)

### Build
- [ ] Release build succeeds
- [ ] AAB (Android App Bundle) created
- [ ] AAB signed with release key
- [ ] AAB size acceptable (< 150MB recommended)
- [ ] APK tested before uploading AAB

### Play Console Setup
- [ ] App created in Play Console
- [ ] App name: "StaticSnack"
- [ ] Short description (max 80 chars)
- [ ] Full description written (max 4000 chars)
- [ ] Category: Developer Tools
- [ ] Tags added
- [ ] Contact email set
- [ ] Privacy Policy URL added (REQUIRED)
- [ ] Website URL added (optional)

### Graphics Required
- [ ] App icon: 512x512 (32-bit PNG)
- [ ] Feature graphic: 1024x500 (REQUIRED)
- [ ] Phone screenshots: at least 2 (320-3840px)
- [ ] 7-inch tablet screenshots: at least 1 (if supporting)
- [ ] 10-inch tablet screenshots: at least 1 (if supporting)
- [ ] Promo video (YouTube URL, optional)

### Content Rating
- [ ] Content rating questionnaire completed
- [ ] Rating certificate received
- [ ] Rating applied to app

### Store Presence
- [ ] Store listing preview checked
- [ ] All required fields filled
- [ ] Graphics look correct in preview
- [ ] Screenshots show key features
- [ ] Description is clear and compelling

### Distribution
- [ ] Countries/regions selected
- [ ] Pricing set (Free or Paid)
- [ ] In-app products configured (if any)
- [ ] Distribution channel selected (Open testing, Closed testing, or Production)

### Submission
- [ ] AAB uploaded to chosen track
- [ ] Release notes added
- [ ] Rollout percentage set (if phased rollout)
- [ ] Review and submit button clicked

## 🔒 Security Checklist

### Code Security
- [ ] No hardcoded API keys
- [ ] No sensitive data in code
- [ ] Environment variables used for secrets
- [ ] HTTPS used for all network requests
- [ ] Certificate pinning considered
- [ ] No console.log with sensitive data

### Data & Privacy
- [ ] User data encrypted in transit
- [ ] User data encrypted at rest (Supabase handles this)
- [ ] Privacy policy accurately describes data collection
- [ ] GDPR compliance implemented
- [ ] User can delete their account
- [ ] User can export their data

### Authentication
- [ ] Secure authentication flow
- [ ] Session management tested
- [ ] Token refresh working
- [ ] Logout working correctly
- [ ] Password reset flow tested

## 📊 Quality Checklist

### Performance
- [ ] App loads in < 3 seconds
- [ ] No memory leaks detected
- [ ] Images optimized
- [ ] API calls optimized
- [ ] Caching implemented
- [ ] Offline functionality works

### UX/UI
- [ ] All buttons and links work
- [ ] Navigation is intuitive
- [ ] Error messages are clear
- [ ] Loading states shown
- [ ] Empty states handled
- [ ] Responsive on all screen sizes
- [ ] Dark mode works (if implemented)
- [ ] Accessibility tested

### Content
- [ ] All text is spelled correctly
- [ ] No placeholder text ("Lorem ipsum")
- [ ] All images load correctly
- [ ] Icons consistent throughout
- [ ] Brand colors consistent

## 📝 Documentation Checklist

### For Team
- [ ] Build process documented
- [ ] Deployment process documented
- [ ] Environment variables documented
- [ ] Common issues documented
- [ ] Contact information updated

### For Users
- [ ] Help/FAQ available
- [ ] Tutorial/onboarding created
- [ ] Support channel established
- [ ] Release notes prepared

## 🚀 Launch Preparation

### Marketing
- [ ] Landing page ready
- [ ] Social media posts prepared
- [ ] Press release drafted (if applicable)
- [ ] Product Hunt launch planned (optional)
- [ ] Email announcement prepared

### Monitoring
- [ ] Analytics configured
- [ ] Crash reporting set up (e.g., Sentry)
- [ ] Performance monitoring enabled
- [ ] Error tracking configured
- [ ] App Store ratings monitoring set up

### Support
- [ ] Support email monitored
- [ ] Response templates prepared
- [ ] FAQ page created
- [ ] Bug tracking system ready

## ⚠️ Common Rejection Reasons

Review these to avoid rejection:

### iOS
- [ ] App doesn't crash on launch
- [ ] Privacy policy link works and is relevant
- [ ] All required permissions are explained
- [ ] App provides value beyond a website wrapper
- [ ] No broken links
- [ ] Screenshots match actual app
- [ ] Test account provided (if login required)

### Android
- [ ] Privacy policy is accessible
- [ ] App doesn't request unnecessary permissions
- [ ] Target API level is recent
- [ ] No deceptive behavior
- [ ] Content rating is accurate
- [ ] Screenshots are clear and relevant
- [ ] Feature graphic has no padding/borders

## 🎯 Final Review

Before clicking submit:
- [ ] Re-read app description for typos
- [ ] Verify all URLs work
- [ ] Check all screenshots are correct
- [ ] Verify version numbers are correct
- [ ] Ensure privacy policy is up to date
- [ ] Confirm support email is monitored
- [ ] Test app one more time on physical device
- [ ] Take a deep breath - you've got this! 🚀

## 📞 Need Help?

- Review [APP_STORE_SUBMISSION.md](./APP_STORE_SUBMISSION.md) for detailed instructions
- Check [QUICK_START_APP_STORES.md](./QUICK_START_APP_STORES.md) for quick commands
- Apple Support: https://developer.apple.com/support/
- Google Support: https://support.google.com/googleplay/android-developer/

---

**Remember**: First submissions often take 1-7 days for review. Plan accordingly!

Good luck with your submission! 🎉

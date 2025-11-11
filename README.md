# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/6f3bd631-4e7b-4101-aa7d-609ec28e7247

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/6f3bd631-4e7b-4101-aa7d-609ec28e7247) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Site Assets Configuration

This project includes a JSON schema for `site-assets.json` files that define manageable assets for static sites.

### Quick Start

Create a `site-assets.json` file in your static site repository:

```json
{
  "$schema": "https://raw.githubusercontent.com/StaticSnack/staticsnack/main/site-assets.schema.json",
  "version": "1.0",
  "assets": [
    {
      "path": "images/hero.jpg",
      "type": "image",
      "label": "Hero Image",
      "maxSize": 2097152,
      "allowedExtensions": [".jpg", ".png", ".webp"]
    }
  ]
}
```

### Documentation

- **Schema Documentation**: [SITE_ASSETS_SCHEMA.md](./SITE_ASSETS_SCHEMA.md) - Complete schema reference
- **Schema File**: [site-assets.schema.json](./site-assets.schema.json) - JSON Schema definition
- **Complete Example**: [examples/site-assets-complete-example.json](./examples/site-assets-complete-example.json)
- **Calendar Assets Guide**: [CALENDAR_ASSETS_GUIDE.md](./CALENDAR_ASSETS_GUIDE.md)

### Supported Asset Types

- Images, videos, audio files
- Text, Markdown, HTML, CSS, JavaScript
- JSON data and calendar events
- Documents (PDF, etc.)
- Directories with multiple assets

The schema provides IDE autocomplete and validation when you reference it in your `site-assets.json` file.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/6f3bd631-4e7b-4101-aa7d-609ec28e7247) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## How can I publish this PWA to app stores?

This project is configured with Capacitor to publish as a native app to both iOS App Store and Google Play Store.

### Quick Start

```bash
# For iOS (requires macOS with Xcode)
npm run cap:build:ios

# For Android (requires Android Studio)
npm run cap:build:android
```

### Documentation

- **Quick Start Guide**: [QUICK_START_APP_STORES.md](./QUICK_START_APP_STORES.md) - Fast reference for building and submitting
- **Detailed Guide**: [APP_STORE_SUBMISSION.md](./APP_STORE_SUBMISSION.md) - Complete step-by-step instructions

### Prerequisites

- **iOS**: Apple Developer Account ($99/year) + macOS with Xcode
- **Android**: Google Play Developer Account ($25 one-time) + Android Studio
- **Both**: Privacy Policy URL (required by both app stores)

### Key Commands

```bash
npm run build                  # Build web app
npm run cap:sync              # Sync to native projects
npm run cap:open:ios          # Open iOS project in Xcode
npm run cap:open:android      # Open Android project in Android Studio
npm run assets:generate       # Regenerate app icons and splash screens
```

### Over-The-Air (OTA) Updates ⚡

**Your app is configured for automatic OTA updates!** When you deploy web changes, mobile users get them automatically without app store updates.

**Deploy Updates:**
```bash
npm run build           # Build your changes
# Deploy dist/ to hosting → Users auto-update within 5 minutes!
```

**Only submit to app stores when:**
- Adding/updating Capacitor plugins
- Changing native code
- Modifying permissions

See [OTA_UPDATES_CONFIGURED.md](./OTA_UPDATES_CONFIGURED.md) for complete details.

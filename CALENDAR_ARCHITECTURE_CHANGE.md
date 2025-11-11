# Calendar Architecture Change Summary

## Overview

The calendar integration approach has been **completely redesigned** to separate concerns between Static Snack and static sites.

## Old Approach ❌

**Static Snack handled everything:**
- Stored API keys
- Made calendar API calls
- Synced events
- Returned event data

**Problems:**
- Security concerns (API keys in Static Snack)
- Centralized API rate limits
- Less flexible for sites
- Static Snack becomes a bottleneck

## New Approach ✅

**Static Snack:** Configuration only
- Stores which calendar to display
- Provides configuration UI for content managers
- Declares available providers per site

**Static Site:** Handles all data
- Makes API calls with own keys
- Manages authentication
- Controls caching and refresh
- Full control over implementation

## What Changed

### 1. Asset Configuration

**Before:**
```json
{
  "type": "calendar",
  "schema": {
    "type": "array",
    "items": { /* event schema */ }
  }
}
```

**After:**
```json
{
  "type": "calendar",
  "metadata": {
    "calendarType": "external",
    "availableProviders": ["google", "outlook"]
  },
  "schema": {
    "type": "object",
    "properties": {
      "provider": { "enum": ["google", "outlook"] },
      "calendarId": { "type": "string" },
      "refreshInterval": { "type": "number" }
    }
  }
}
```

### 2. Calendar Data Files

**Local Events (unchanged):**
```json
[
  {
    "id": "event-1",
    "title": "Meeting",
    "startDate": "2025-11-10T10:00:00",
    ...
  }
]
```

**External Calendar Config (new):**
```json
{
  "provider": "google",
  "calendarId": "primary",
  "displayName": "Company Calendar",
  "refreshInterval": 15,
  "maxEvents": 100,
  "daysAhead": 90
}
```

### 3. Components

**CalendarAssetManager** - Refactored:
- Removed API sync functionality
- Added provider availability display
- Shows setup instructions
- Links to implementation guide
- Config-focused UI

**Removed:**
- API key input fields
- Sync buttons
- Direct calendar API calls

**Added:**
- Available providers badge display
- Provider documentation links
- Implementation workflow explanation

### 4. Backend

**Edge Function** (`sync-external-calendar`):
- Now **deprecated** or used as reference
- Sites don't call this anymore
- May be removed in future

**New Pattern:**
- Sites implement their own calendar services
- Load configuration from Static Snack
- Make API calls client-side or via their backend

## Benefits

### Security ✅
- API keys stay with the site owner
- No centralized key storage
- Better compliance (GDPR, etc.)

### Performance ✅
- No proxy through Static Snack
- Direct API calls from site
- Site controls caching strategy
- No rate limit sharing

### Flexibility ✅
- Sites choose implementation
- Can use client-side or server-side
- Custom filtering and processing
- Framework-agnostic

### Scalability ✅
- No bottleneck at Static Snack
- Each site's usage independent
- Better for high-traffic sites

## Migration Guide

### For Existing Sites

If you were using the old sync approach:

1. **Remove old calendar data files** that contained synced events
2. **Create calendar config file** with provider and calendar ID
3. **Implement calendar fetching** in your site (see implementation guide)
4. **Set up API keys** in your environment
5. **Update asset configuration** with available providers

### For New Sites

1. **Add calendar asset** to `assets.config.json`
2. **Specify available providers** in metadata
3. **Implement calendar service** in your site
4. **Configure which calendar** via Asset Manager
5. **Display events** using your preferred method

## Configuration Examples

### Single Calendar
```json
{
  "path": "data/calendar-config.json",
  "type": "calendar",
  "metadata": {
    "calendarType": "external",
    "availableProviders": ["google"]
  },
  "schema": {
    "type": "object",
    "properties": {
      "provider": { "enum": ["google"] },
      "calendarId": { "type": "string" },
      "displayName": { "type": "string" }
    }
  }
}
```

### Multiple Calendars
```json
{
  "path": "data/calendars.json",
  "type": "calendar",
  "metadata": {
    "calendarType": "external",
    "availableProviders": ["google", "outlook", "apple"]
  },
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "provider": { "enum": ["google", "outlook", "apple"] },
        "calendarId": { "type": "string" }
      }
    }
  }
}
```

## Implementation

See `EXTERNAL_CALENDAR_IMPLEMENTATION.md` for:
- Complete setup guide
- API integration code
- Service class implementations
- Framework examples (React, Vue)
- Error handling patterns
- Caching strategies

## Local Events Still Supported

The local events feature (array of event objects) is **unchanged** and continues to work as before:

```json
{
  "path": "data/events.json",
  "type": "calendar",
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        ...
      }
    }
  }
}
```

## Key Takeaways

1. **Static Snack = Configuration Store**
   - No API calls
   - No key management
   - Just config UI

2. **Static Site = Implementation**
   - Owns API keys
   - Makes all requests
   - Full control

3. **Content Managers = Selector**
   - Choose calendar to display
   - Configure settings
   - Can only pick from available providers

4. **Better for Everyone**
   - More secure
   - More performant
   - More flexible
   - More scalable

## Questions?

- **How do I set up API keys?** See `EXTERNAL_CALENDAR_IMPLEMENTATION.md`
- **Can I still use local events?** Yes, unchanged
- **What about the old edge function?** Deprecated, don't use
- **Do I need to migrate?** Only if using external calendars
- **Which providers are supported?** Google, Outlook, Apple (any you implement)

## Timeline

- **v1.0**: Old approach with sync
- **v2.0**: New config-only approach (current)
- **v3.0**: May remove old edge function entirely

The new approach is production-ready and recommended for all new implementations! 🚀

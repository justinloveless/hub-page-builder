# Calendar/Events Asset Type - Implementation Summary

## Overview

Successfully implemented a comprehensive calendar/events asset type system that supports both local JSON-based event management and external calendar integration (Google Calendar, Apple Calendar, Outlook Calendar).

## What Was Added

### 1. Core Asset Type Support

#### Icon Support (`src/components/AssetManager/utils.tsx`)
- Added Calendar icon from lucide-react
- Calendar and events assets display with a purple calendar icon

#### Asset Upload Dialog Updates (`src/components/AssetUploadDialog.tsx`)
- Added `isCalendarAsset` detection for `calendar` and `events` types
- Calendar assets can be edited using the JSON schema editor
- Full support for structured event data with schema validation

### 2. Calendar JSON Schema

The calendar asset type supports a flexible schema with the following event properties:
- **title** - Event name
- **description** - Event details (multiline)
- **startDate** - ISO format start date/time
- **endDate** - ISO format end date/time
- **location** - Physical or virtual location
- **allDay** - Boolean flag for all-day events
- **recurring** - Pattern: daily, weekly, monthly, yearly
- **color** - Hex color code for visual representation
- **attendees** - Comma-separated email list
- **externalId** - ID from external calendar (for synced events)
- **synced** - Boolean flag for externally synced events

### 3. Backend Integration

#### New Edge Function: `sync-external-calendar`
Location: `supabase/functions/sync-external-calendar/index.ts`

Features:
- **Google Calendar** integration via Calendar API v3
- **Outlook Calendar** integration via Microsoft Graph API
- **Apple Calendar** integration via CalDAV protocol
- Fetches upcoming events from external calendars
- Converts external event formats to unified schema
- Returns synced events in standardized format

### 4. UI Components

#### CalendarAssetManager Component
Location: `src/components/CalendarAssetManager.tsx`

Features:
- Dual-mode interface: Local events and External sync
- Import/Export functionality for event JSON
- Provider-specific setup instructions with documentation links
- Real-time sync with external calendars
- Visual event list with badges for recurring, all-day, and synced events
- Last sync timestamp display

### 5. Documentation

#### Comprehensive Guide: `CALENDAR_ASSETS_GUIDE.md`
Includes:
- Setup instructions for local calendar events
- JSON schema configuration examples
- External calendar integration setup for all three providers
- API credentials and authentication guide
- JavaScript code examples for loading and filtering events
- Best practices and troubleshooting
- Advanced features and custom properties
- API reference with TypeScript interfaces

### 6. Examples

#### Configuration Example: `examples/calendar-assets-config.json`
Two asset configurations:
1. **Local Events** - Simple calendar with basic event schema
2. **Synced Calendar** - Advanced config with external sync metadata and configuration properties

#### Sample Data: `examples/sample-events.json`
7 diverse example events:
- Daily standups
- Product launches
- Client demos
- Quarterly reviews
- Company parties
- Workshops
- Investor calls

#### Display Example: `examples/calendar-display-example.html`
Full-featured web page with:
- Modern gradient design
- Event grid display with color coding
- "Next Week" upcoming events section
- Filter buttons (All, Upcoming, Recurring, All Day)
- Responsive layout
- Event cards with badges and metadata
- Real-time date formatting

## How to Use

### 1. Local Calendar Events

Add to your site's `assets.config.json`:
```json
{
  "version": "1.0",
  "assets": [
    {
      "path": "data/events.json",
      "type": "calendar",
      "label": "Events Calendar",
      "description": "Manage your calendar events",
      "maxSize": 1048576,
      "allowedExtensions": [".json"],
      "schema": { /* see guide for full schema */ }
    }
  ]
}
```

### 2. External Calendar Sync

#### Google Calendar:
1. Get API key from Google Cloud Console
2. Use CalendarAssetManager component
3. Select "Google Calendar" provider
4. Enter calendar ID (email or "primary")
5. Enter API key
6. Click "Sync Calendar"

#### Apple Calendar:
1. Generate app-specific password at appleid.apple.com
2. Select "Apple Calendar" provider
3. Enter calendar ID ("home")
4. Enter app-specific password
5. Click "Sync Calendar"

#### Outlook Calendar:
1. Register app in Azure Portal
2. Get access token via OAuth 2.0
3. Select "Outlook Calendar" provider
4. Enter calendar ID
5. Enter access token
6. Click "Sync Calendar"

### 3. Display Events on Your Site

Use the example HTML file as a template or integrate with your framework:

```javascript
// Load events
const response = await fetch('data/events.json');
const events = await response.json();

// Display with your favorite calendar library
// FullCalendar, React Big Calendar, etc.
```

## API Endpoints

### Sync External Calendar
```typescript
POST /functions/v1/sync-external-calendar
Body: {
  site_id: string,
  provider: 'google' | 'apple' | 'outlook',
  calendar_id: string,
  api_key?: string,
  access_token?: string,
  asset_path: string
}

Response: {
  success: boolean,
  events: Record<string, CalendarEvent>,
  count: number,
  lastSync: string,
  provider: string,
  calendarId: string
}
```

## File Structure

```
/workspace/
├── src/
│   └── components/
│       ├── AssetManager/
│       │   └── utils.tsx (updated with calendar icon)
│       ├── AssetUploadDialog.tsx (updated with calendar support)
│       └── CalendarAssetManager.tsx (new component)
├── supabase/
│   └── functions/
│       └── sync-external-calendar/
│           └── index.ts (new edge function)
├── examples/
│   ├── calendar-assets-config.json
│   ├── sample-events.json
│   └── calendar-display-example.html
├── CALENDAR_ASSETS_GUIDE.md (comprehensive documentation)
└── CALENDAR_IMPLEMENTATION_SUMMARY.md (this file)
```

## Technical Details

### Event Data Structure
Events are stored as an array of objects in JSON:
```json
[
  {
    "id": "event-unique-id",
    "title": "Event Name",
    "startDate": "2025-11-10T10:00:00",
    // ... other properties
  }
]
```

### Schema Validation
The asset manager's JSON schema editor provides:
- Type validation (string, boolean, enum)
- Field descriptions and placeholders
- Multiline text support
- Default values
- Dynamic form generation

### External Calendar Sync
- Fetches upcoming events only (performance optimization)
- Converts provider-specific formats to unified schema
- Maintains external IDs for tracking
- Supports pagination (up to 100 events per sync)
- Error handling with detailed messages

## Security Considerations

⚠️ **Important Security Notes:**
1. Never commit API keys or tokens to version control
2. Use environment variables for sensitive credentials
3. Implement proper authentication in edge functions
4. Respect calendar provider rate limits
5. Store credentials securely (consider encrypted secrets)
6. Validate all external calendar data before storage

## Future Enhancements

Potential improvements:
1. **Webhook Support** - Real-time updates from external calendars
2. **Two-way Sync** - Create/update events in external calendars
3. **Calendar Views** - Built-in month/week/day views
4. **Notifications** - Event reminders and alerts
5. **iCal Export** - Download events as .ics files
6. **Recurring Event Expansion** - Auto-generate recurring event instances
7. **Time Zone Support** - Multiple timezone handling
8. **Event Categories/Tags** - Advanced filtering and organization
9. **Conflict Detection** - Warn about overlapping events
10. **Batch Sync** - Sync multiple calendars simultaneously

## Testing

To test the implementation:
1. Create a test site with calendar asset configuration
2. Add sample events using the Asset Manager
3. Use the CalendarAssetManager to test external sync (optional)
4. Deploy the example HTML file to view events
5. Test filtering and display functionality

## Support

For issues or questions:
- Check `CALENDAR_ASSETS_GUIDE.md` for detailed instructions
- Review example files in `/examples/`
- Verify API credentials are correct
- Check browser console for errors
- Ensure JSON syntax is valid

## Conclusion

The calendar/events asset type is now fully integrated into the asset management system with support for:
✅ Local JSON-based event storage
✅ Structured schema with validation
✅ External calendar synchronization (Google, Apple, Outlook)
✅ Rich UI components for management
✅ Comprehensive documentation and examples
✅ Production-ready code with error handling

Users can now easily manage events either as local data or sync with their existing calendars!

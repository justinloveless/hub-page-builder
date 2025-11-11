# Calendar/Events Asset Type Feature

## 🎉 What's New

A complete calendar/events asset type has been added to the asset management system! You can now manage calendar events either as local JSON data or sync with external calendars like Google Calendar, Apple Calendar, and Outlook Calendar.

## 📁 Files Added/Modified

### New Files
1. **`/workspace/src/components/CalendarAssetManager.tsx`**
   - React component for managing calendar assets with external sync
   
2. **`/workspace/supabase/functions/sync-external-calendar/index.ts`**
   - Edge function for syncing with Google, Apple, and Outlook calendars

3. **`/workspace/examples/calendar-assets-config.json`**
   - Example configuration for calendar assets

4. **`/workspace/examples/sample-events.json`**
   - 7 sample events demonstrating all features

5. **`/workspace/examples/calendar-display-example.html`**
   - Beautiful, responsive web page for displaying events

6. **`/workspace/CALENDAR_ASSETS_GUIDE.md`**
   - Comprehensive 400+ line guide with setup, examples, and best practices

7. **`/workspace/CALENDAR_IMPLEMENTATION_SUMMARY.md`**
   - Technical implementation details and architecture

8. **`/workspace/QUICK_START_CALENDAR.md`**
   - Get started in 5 minutes guide

9. **`/workspace/README_CALENDAR_FEATURE.md`**
   - This file - feature overview

### Modified Files
1. **`/workspace/src/components/AssetManager/utils.tsx`**
   - Added Calendar icon for calendar asset types

2. **`/workspace/src/components/AssetUploadDialog.tsx`**
   - Added support for editing calendar assets with JSON schema

## 🚀 Quick Start

### 1. Local Calendar Events

Add to your `assets.config.json`:
```json
{
  "path": "data/events.json",
  "type": "calendar",
  "label": "Events",
  "schema": { /* see examples */ }
}
```

### 2. Create Events

Use the Asset Manager UI to add events with:
- Title, description, dates
- Location (physical or virtual)
- All-day or timed events
- Recurring patterns
- Color coding
- Attendee lists

### 3. Display on Site

```javascript
fetch('data/events.json')
  .then(res => res.json())
  .then(events => displayEvents(events));
```

### 4. External Calendar (Optional)

**Configuration-based approach:**

1. **Declare providers** in your assets.config.json
2. **Implement fetching** in your site with your API keys
3. **Configure calendar** via Asset Manager
4. **Display events** from external provider

See `EXTERNAL_CALENDAR_IMPLEMENTATION.md` for complete guide.

## 📋 Features

### ✅ Local Event Management
- JSON-based storage in your repository
- Schema validation with structured forms
- Import/Export functionality
- Full CRUD operations through UI

### ✅ External Calendar Integration
- Configuration storage for external calendars
- Provider availability declaration per site
- Your site fetches from Google Calendar
- Your site fetches from Apple Calendar (iCloud)
- Your site fetches from Outlook/Microsoft 365
- Flexible implementation (client or server-side)

### ✅ Event Properties
- Title and description
- Start/end dates (ISO format)
- Location (physical or virtual URLs)
- All-day event flag
- Recurring patterns (daily, weekly, monthly, yearly)
- Color coding
- Attendee lists
- External IDs for synced events

### ✅ UI Components
- Calendar icon with purple color scheme
- Visual event cards with metadata
- Filter buttons (all, upcoming, recurring, all-day)
- "Next Week" upcoming events section
- Responsive design
- Badge indicators for event types

### ✅ Developer Features
- TypeScript interfaces
- Schema-based validation
- Error handling
- Comprehensive documentation
- Working examples
- API reference

## 🔧 Technical Details

### Asset Type
- Type: `"calendar"` or `"events"`
- Format: JSON with key-value pairs
- Schema: Flexible with additionalProperties support

### External Calendar Architecture
- **Static Snack**: Stores configuration only (which calendar to display)
- **Your Site**: Makes API calls with your own keys
- **Providers**: Google Calendar API v3, Microsoft Graph API, CalDAV
- **Security**: API keys stay with site owner, not centralized

### Configuration Format
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

### Event Data Structure
```typescript
interface CalendarEvent {
  id: string;        // Unique identifier
  title: string;
  description?: string;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  location?: string;
  allDay?: boolean;
  recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly' | '';
  color?: string;    // Hex code
  attendees?: string; // Comma-separated
  externalId?: string;
  synced?: boolean;
}
```

## 📚 Documentation

1. **QUICK_START_CALENDAR.md** - 5-minute setup guide
2. **CALENDAR_ASSETS_GUIDE.md** - Complete feature documentation
3. **CALENDAR_IMPLEMENTATION_SUMMARY.md** - Technical architecture
4. **examples/** - Working code samples

## 🔐 Security Notes

⚠️ **Important:**
- Never commit API keys to version control
- Use environment variables for credentials
- Implement proper token storage
- Respect API rate limits
- Validate external data

## 🎨 Example Use Cases

1. **Company Events** - Team meetings, launches, parties
2. **Project Milestones** - Deadlines, demos, reviews
3. **Public Events** - Workshops, conferences, webinars
4. **Personal Calendars** - Appointments, reminders
5. **Resource Booking** - Room reservations, equipment
6. **Multi-calendar Aggregation** - Combine multiple sources

## 🔄 Future Enhancements

Potential additions:
- Two-way sync (create/edit in external calendars)
- Webhook support for real-time updates
- Built-in calendar views (month/week/day)
- Event notifications and reminders
- iCal export (.ics files)
- Time zone support
- Conflict detection

## 🧪 Testing

Try it out:
1. Copy `examples/calendar-assets-config.json` to your site
2. Add some events using the UI
3. Open `examples/calendar-display-example.html` in browser
4. (Optional) Test external sync with your calendar

## 📞 Support

For questions or issues:
- Check the documentation files
- Review example implementations
- Verify JSON format is valid
- Ensure dates are ISO 8601 format
- Check API credentials

## ✨ Summary

You now have a production-ready calendar/events system with:
- ✅ Local JSON storage
- ✅ External calendar sync (Google, Apple, Outlook)
- ✅ Rich UI components
- ✅ Complete documentation
- ✅ Working examples
- ✅ TypeScript support

Ready to use! 🎊

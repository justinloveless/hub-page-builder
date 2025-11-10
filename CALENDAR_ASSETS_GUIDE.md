# Calendar/Events Asset Type Guide

This guide explains how to use the calendar/events asset type in your site's asset configuration.

## Overview

The calendar asset type allows you to manage events and calendar data in two ways:
1. **Local JSON data** - Store event data directly in a JSON file with a predefined schema
2. **External calendar integration** - Link to live calendars from Google Calendar, Apple Calendar, or Outlook Calendar

## Local Calendar Events (JSON)

### Basic Configuration

Add this to your site's `assets.config.json`:

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
      "schema": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string",
              "title": "Event Title",
              "description": "The name of the event",
              "placeholder": "Team Meeting"
            },
            "description": {
              "type": "string",
              "title": "Description",
              "description": "Event details and information",
              "placeholder": "Discuss project progress...",
              "multiline": true
            },
            "startDate": {
              "type": "string",
              "title": "Start Date",
              "description": "ISO format date-time (e.g., 2025-11-10T10:00:00)",
              "placeholder": "2025-11-10T10:00:00"
            },
            "endDate": {
              "type": "string",
              "title": "End Date",
              "description": "ISO format date-time (e.g., 2025-11-10T11:00:00)",
              "placeholder": "2025-11-10T11:00:00"
            },
            "location": {
              "type": "string",
              "title": "Location",
              "description": "Physical or virtual location",
              "placeholder": "Conference Room A or https://zoom.us/..."
            },
            "allDay": {
              "type": "boolean",
              "title": "All Day Event",
              "description": "Mark this event as an all-day event",
              "default": false
            },
            "recurring": {
              "type": "string",
              "title": "Recurring",
              "description": "Recurrence pattern for the event",
              "enum": ["", "daily", "weekly", "monthly", "yearly"],
              "placeholder": "Select recurrence..."
            },
            "color": {
              "type": "string",
              "title": "Event Color",
              "description": "Visual color for the event (hex code)",
              "placeholder": "#3b82f6"
            },
            "attendees": {
              "type": "string",
              "title": "Attendees",
              "description": "Comma-separated list of attendee emails",
              "placeholder": "john@example.com, jane@example.com",
              "multiline": true
            }
          }
        }
      }
    }
  ]
}
```

### Example Event Data

Your `data/events.json` file would look like this:

```json
{
  "team-meeting-nov-10": {
    "title": "Team Standup",
    "description": "Daily team sync-up meeting",
    "startDate": "2025-11-10T09:00:00",
    "endDate": "2025-11-10T09:30:00",
    "location": "Conference Room A",
    "allDay": false,
    "recurring": "daily",
    "color": "#3b82f6",
    "attendees": "team@example.com"
  },
  "project-launch": {
    "title": "Product Launch Event",
    "description": "Official launch of our new product line",
    "startDate": "2025-12-01T00:00:00",
    "endDate": "2025-12-01T23:59:59",
    "location": "Main Auditorium",
    "allDay": true,
    "recurring": "",
    "color": "#10b981",
    "attendees": "all@example.com, press@example.com"
  },
  "client-demo": {
    "title": "Client Demo Presentation",
    "description": "Demonstrate new features to key client",
    "startDate": "2025-11-15T14:00:00",
    "endDate": "2025-11-15T15:00:00",
    "location": "https://zoom.us/j/123456789",
    "allDay": false,
    "recurring": "",
    "color": "#f59e0b",
    "attendees": "client@example.com, sales@example.com"
  }
}
```

## External Calendar Integration

### Configuration with Calendar Sync

For external calendar integration, add metadata to enable syncing:

```json
{
  "path": "data/calendar.json",
  "type": "calendar",
  "label": "Synced Calendar",
  "description": "Calendar synced with external provider",
  "maxSize": 1048576,
  "allowedExtensions": [".json"],
  "metadata": {
    "externalSync": true,
    "providers": ["google", "apple", "outlook"],
    "syncInterval": "hourly"
  },
  "schema": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "title": "Calendar Provider",
        "description": "External calendar service",
        "enum": ["local", "google", "apple", "outlook"],
        "default": "local"
      },
      "calendarId": {
        "type": "string",
        "title": "Calendar ID",
        "description": "External calendar identifier (for synced calendars)",
        "placeholder": "primary or calendar-id@group.calendar.google.com"
      },
      "apiKey": {
        "type": "string",
        "title": "API Key / Token",
        "description": "Authentication token for calendar access (store securely)",
        "placeholder": "Your API key or OAuth token"
      },
      "lastSync": {
        "type": "string",
        "title": "Last Sync Time",
        "description": "Timestamp of last successful sync",
        "placeholder": "Auto-populated"
      }
    },
    "additionalProperties": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "title": "Event Title"
        },
        "description": {
          "type": "string",
          "title": "Description",
          "multiline": true
        },
        "startDate": {
          "type": "string",
          "title": "Start Date"
        },
        "endDate": {
          "type": "string",
          "title": "End Date"
        },
        "location": {
          "type": "string",
          "title": "Location"
        },
        "allDay": {
          "type": "boolean",
          "title": "All Day Event"
        },
        "externalId": {
          "type": "string",
          "title": "External Event ID",
          "description": "ID from external calendar provider"
        },
        "synced": {
          "type": "boolean",
          "title": "Synced",
          "description": "Whether this event is synced with external provider"
        }
      }
    }
  }
}
```

## Using Calendar Data in Your Site

### Loading Calendar Events

```javascript
// Fetch calendar events from your JSON file
async function loadEvents() {
  const response = await fetch('/data/events.json');
  const events = await response.json();
  return Object.entries(events).map(([id, event]) => ({
    id,
    ...event,
    start: new Date(event.startDate),
    end: new Date(event.endDate)
  }));
}

// Use with a calendar library like FullCalendar
const events = await loadEvents();
const calendar = new FullCalendar.Calendar(calendarEl, {
  initialView: 'dayGridMonth',
  events: events
});
```

### Filtering Events

```javascript
// Get upcoming events
function getUpcomingEvents(events, days = 7) {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  return Object.entries(events)
    .filter(([_, event]) => {
      const start = new Date(event.startDate);
      return start >= now && start <= future;
    })
    .sort((a, b) => 
      new Date(a[1].startDate) - new Date(b[1].startDate)
    );
}

// Get events by location
function getEventsByLocation(events, location) {
  return Object.entries(events)
    .filter(([_, event]) => 
      event.location?.toLowerCase().includes(location.toLowerCase())
    );
}

// Get recurring events
function getRecurringEvents(events) {
  return Object.entries(events)
    .filter(([_, event]) => event.recurring && event.recurring !== '');
}
```

## External Calendar Sync Setup

### Google Calendar

1. **Get API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project and enable Calendar API
   - Create credentials (API key or OAuth 2.0)

2. **Configure in Asset Manager**:
   - Set provider to "google"
   - Enter your calendar ID (usually your email or "primary")
   - Add your API key/OAuth token

3. **Permissions**: Ensure your app has calendar read permissions

### Apple Calendar (iCloud)

1. **App-Specific Password**:
   - Go to [appleid.apple.com](https://appleid.apple.com/)
   - Generate an app-specific password

2. **CalDAV URL**: Use iCloud's CalDAV server
   - URL: `https://caldav.icloud.com/`
   - Username: Your Apple ID
   - Password: App-specific password

### Outlook Calendar

1. **Microsoft Graph API**:
   - Register app in [Azure Portal](https://portal.azure.com/)
   - Get application ID and secret
   - Request calendar read permissions

2. **Configure**:
   - Set provider to "outlook"
   - Enter your calendar ID
   - Add Microsoft Graph access token

## Best Practices

1. **Date Format**: Always use ISO 8601 format for dates (`YYYY-MM-DDTHH:mm:ss`)
2. **Unique Keys**: Use meaningful, unique identifiers for event keys
3. **Security**: Never commit API keys directly - use environment variables
4. **Sync Frequency**: Don't sync too frequently to avoid rate limits
5. **Validation**: Validate dates and required fields before saving
6. **Time Zones**: Consider storing timezone information with events
7. **Caching**: Cache external calendar data to reduce API calls

## Troubleshooting

### Events Not Showing
- Check date format is valid ISO 8601
- Verify JSON syntax is correct
- Ensure event keys are unique

### External Sync Failed
- Verify API credentials are valid
- Check calendar ID is correct
- Ensure proper permissions are granted
- Review rate limits for the calendar provider

### Performance Issues
- Limit the number of events loaded at once
- Implement pagination for large event lists
- Cache calendar data when possible
- Use date range queries to fetch only needed events

## Advanced Features

### Custom Event Properties

You can extend the schema with custom properties:

```json
{
  "properties": {
    "category": {
      "type": "string",
      "title": "Category",
      "enum": ["meeting", "deadline", "social", "personal"]
    },
    "priority": {
      "type": "string",
      "title": "Priority",
      "enum": ["low", "medium", "high", "urgent"]
    },
    "reminders": {
      "type": "string",
      "title": "Reminders",
      "description": "Comma-separated: 15min, 1hour, 1day",
      "placeholder": "15min, 1hour"
    }
  }
}
```

### Webhook Integration

For real-time updates from external calendars, implement webhooks:

1. Set up webhook endpoint in your backend
2. Register webhook with calendar provider
3. Update local JSON when webhook receives events
4. Trigger UI refresh when data changes

## Example Implementations

Check out example repositories:
- Basic calendar display: `/examples/calendar-basic`
- Synced Google Calendar: `/examples/calendar-google-sync`
- Multi-calendar view: `/examples/calendar-multi`

## API Reference

### Calendar Asset Methods

```typescript
interface CalendarEvent {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  allDay?: boolean;
  recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly' | '';
  color?: string;
  attendees?: string;
  externalId?: string;
  synced?: boolean;
}

interface CalendarConfig {
  provider?: 'local' | 'google' | 'apple' | 'outlook';
  calendarId?: string;
  apiKey?: string;
  lastSync?: string;
}

// Load events
async function loadCalendarEvents(path: string): Promise<Record<string, CalendarEvent>>;

// Sync with external provider
async function syncExternalCalendar(config: CalendarConfig): Promise<void>;

// Create event
async function createEvent(eventId: string, event: CalendarEvent): Promise<void>;

// Update event
async function updateEvent(eventId: string, event: Partial<CalendarEvent>): Promise<void>;

// Delete event
async function deleteEvent(eventId: string): Promise<void>;
```

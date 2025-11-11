# Quick Start: Calendar Events Asset Type

Get up and running with calendar events in 5 minutes!

## Step 1: Add Calendar Asset Configuration

Create or update `assets.config.json` in your site repository:

```json
{
  "version": "1.0",
  "assets": [
    {
      "path": "data/events.json",
      "type": "calendar",
      "label": "My Events",
      "description": "Company calendar and events",
      "maxSize": 1048576,
      "allowedExtensions": [".json"],
      "schema": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "title": "Event ID",
              "placeholder": "team-meeting-2025-11-10"
            },
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
              "title": "Start Date (ISO format)"
            },
            "endDate": {
              "type": "string",
              "title": "End Date (ISO format)"
            },
            "location": {
              "type": "string",
              "title": "Location"
            },
            "allDay": {
              "type": "boolean",
              "title": "All Day Event"
            }
          }
        }
      }
    }
  ]
}
```

## Step 2: Add Your First Event

In the Asset Manager, click on "My Events" and add your first event:

```json
[
  {
    "id": "team-meeting",
    "title": "Team Meeting",
    "description": "Weekly sync-up",
    "startDate": "2025-11-10T10:00:00",
    "endDate": "2025-11-10T11:00:00",
    "location": "Conference Room A",
    "allDay": false
  }
]
```

## Step 3: Display Events on Your Site

Add this to your HTML file:

```html
<div id="events"></div>

<script>
  fetch('data/events.json')
    .then(res => res.json())
    .then(events => {
      const html = events.map(event => `
        <div class="event">
          <h3>${event.title}</h3>
          <p>${event.description}</p>
          <p>📅 ${new Date(event.startDate).toLocaleString()}</p>
          <p>📍 ${event.location}</p>
        </div>
      `).join('');
      document.getElementById('events').innerHTML = html;
    });
</script>
```

## Step 4 (Optional): External Calendar Integration

To display events from Google Calendar, Outlook, or Apple Calendar:

### 1. Configure Available Providers

In your `assets.config.json`, specify which providers your site supports:

```json
{
  "path": "data/calendar-config.json",
  "type": "calendar",
  "metadata": {
    "calendarType": "external",
    "availableProviders": ["google", "outlook"]
  },
  "schema": {
    "type": "object",
    "properties": {
      "provider": {
        "enum": ["google", "outlook"]
      },
      "calendarId": {
        "type": "string"
      }
    }
  }
}
```

### 2. Set Up in Your Site

**Your site handles the API calls, not Static Snack!**

- Set up API keys in your site (Google, Microsoft, Apple)
- Implement calendar fetching service
- Load configuration from `calendar-config.json`
- Fetch and display events

### 3. Configure in Asset Manager

Content managers can then:
- Select which provider to use
- Enter the calendar ID
- Set refresh interval and other options

### Full Implementation Guide

See `EXTERNAL_CALENDAR_IMPLEMENTATION.md` for:
- Complete setup instructions
- Code examples for Google, Outlook, Apple
- React/Vue integration
- Error handling and caching

## Examples

Check out complete examples:
- **Configuration**: `/examples/calendar-assets-config.json`
- **Sample Data**: `/examples/sample-events.json`
- **Display Page**: `/examples/calendar-display-example.html`

## Full Documentation

For detailed information, see:
- `CALENDAR_ASSETS_GUIDE.md` - Complete guide with all features
- `CALENDAR_IMPLEMENTATION_SUMMARY.md` - Technical details

## Need Help?

Common issues:
- **Events not loading**: Check that `data/events.json` exists and is valid JSON
- **Sync failing**: Verify API credentials are correct
- **Schema errors**: Ensure dates are in ISO format (YYYY-MM-DDTHH:mm:ss)

That's it! You now have a working calendar system. 🎉

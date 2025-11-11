# External Calendar Implementation Guide for Static Sites

## Overview

This guide shows how to implement external calendar integration in your static site. Static Snack provides the **configuration interface** where content managers select which calendar to display. Your site handles the **API calls** and **data fetching** using your own API keys.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Static Snack   │         │   Your Static    │         │  Calendar API   │
│  Asset Manager  │────────▶│      Site        │────────▶│  (Google, etc)  │
│                 │         │                  │         │                 │
│  Stores config  │         │  Reads config    │         │  Returns events │
│  (calendar ID,  │         │  Makes API calls │         │                 │
│   provider)     │         │  with own keys   │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

## Step 1: Configure Available Providers

In your `assets.config.json`, specify which calendar providers your site supports:

```json
{
  "version": "1.0",
  "assets": [
    {
      "path": "data/calendar-config.json",
      "type": "calendar",
      "label": "Calendar Settings",
      "description": "Configure which calendar to display",
      "maxSize": 102400,
      "allowedExtensions": [".json"],
      "metadata": {
        "calendarType": "external",
        "availableProviders": ["google", "outlook"]
      },
      "schema": {
        "type": "object",
        "properties": {
          "provider": {
            "type": "string",
            "title": "Calendar Provider",
            "enum": ["google", "outlook"],
            "description": "Select your calendar provider"
          },
          "calendarId": {
            "type": "string",
            "title": "Calendar ID"
          },
          "displayName": {
            "type": "string",
            "title": "Display Name"
          },
          "refreshInterval": {
            "type": "number",
            "title": "Refresh Interval (minutes)",
            "default": 15
          },
          "maxEvents": {
            "type": "number",
            "title": "Maximum Events",
            "default": 100
          },
          "daysAhead": {
            "type": "number",
            "title": "Days Ahead",
            "default": 90
          }
        }
      }
    }
  ]
}
```

**Key Point**: Only list providers in `availableProviders` that you have set up in your site. Content managers can only select from these options.

## Step 2: Set Up API Keys in Your Site

### For Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing one
3. Enable the Google Calendar API
4. Create credentials (API key or OAuth 2.0)
5. Store the API key in your environment variables

```bash
# .env
VITE_GOOGLE_CALENDAR_API_KEY=your-api-key-here
```

### For Microsoft Outlook/365

1. Register app in [Azure Portal](https://portal.azure.com/)
2. Configure API permissions for Calendar.Read
3. Implement OAuth 2.0 flow
4. Store credentials securely

```bash
# .env
VITE_MICROSOFT_CLIENT_ID=your-client-id
VITE_MICROSOFT_CLIENT_SECRET=your-client-secret
```

### For Apple Calendar (iCloud)

1. Generate app-specific password at [appleid.apple.com](https://appleid.apple.com/)
2. Store credentials securely

```bash
# .env
VITE_ICLOUD_USERNAME=your-apple-id
VITE_ICLOUD_PASSWORD=app-specific-password
```

## Step 3: Load Calendar Configuration

In your static site, fetch the calendar configuration from Static Snack:

```javascript
// Load calendar config
async function loadCalendarConfig() {
  const response = await fetch('/data/calendar-config.json');
  const config = await response.json();
  return config;
}

// Usage
const config = await loadCalendarConfig();
console.log(config);
// {
//   provider: "google",
//   calendarId: "primary",
//   displayName: "Company Calendar",
//   refreshInterval: 15,
//   maxEvents: 100,
//   daysAhead: 90
// }
```

## Step 4: Implement Calendar Fetching

### Google Calendar Implementation

```javascript
class GoogleCalendarService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.googleapis.com/calendar/v3';
  }

  async getEvents(calendarId, options = {}) {
    const {
      maxEvents = 100,
      daysAhead = 90,
      showPastEvents = false
    } = options;

    const now = new Date();
    const timeMin = showPastEvents 
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : now.toISOString();
    
    const timeMax = new Date(
      now.getTime() + daysAhead * 24 * 60 * 60 * 1000
    ).toISOString();

    const params = new URLSearchParams({
      key: this.apiKey,
      timeMin,
      timeMax,
      maxResults: maxEvents,
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeEvents(data.items || []);
  }

  normalizeEvents(items) {
    return items.map(item => ({
      id: item.id,
      title: item.summary || 'Untitled Event',
      description: item.description || '',
      startDate: item.start.dateTime || item.start.date,
      endDate: item.end.dateTime || item.end.date,
      location: item.location || '',
      allDay: !item.start.dateTime,
      recurring: item.recurrence ? 'custom' : '',
      color: this.getColorFromId(item.colorId),
      attendees: item.attendees?.map(a => a.email).join(', ') || '',
      externalId: item.id,
      provider: 'google'
    }));
  }

  getColorFromId(colorId) {
    const colors = {
      '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff',
      '4': '#ff887c', '5': '#fbd75b', '6': '#ffb878',
      '7': '#46d6db', '8': '#e1e1e1', '9': '#5484ed',
      '10': '#51b749', '11': '#dc2127'
    };
    return colors[colorId] || '#3b82f6';
  }
}
```

### Outlook Calendar Implementation

```javascript
class OutlookCalendarService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://graph.microsoft.com/v1.0';
  }

  async getEvents(calendarId, options = {}) {
    const {
      maxEvents = 100,
      daysAhead = 90,
      showPastEvents = false
    } = options;

    const now = new Date();
    const startDate = showPastEvents 
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : now.toISOString();
    
    const endDate = new Date(
      now.getTime() + daysAhead * 24 * 60 * 60 * 1000
    ).toISOString();

    const url = `${this.baseUrl}/me/calendars/${calendarId}/events`;
    const params = new URLSearchParams({
      $filter: `start/dateTime ge '${startDate}' and end/dateTime le '${endDate}'`,
      $top: maxEvents,
      $orderby: 'start/dateTime'
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Outlook Calendar API error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeEvents(data.value || []);
  }

  normalizeEvents(items) {
    return items.map(item => ({
      id: item.id,
      title: item.subject || 'Untitled Event',
      description: item.bodyPreview || '',
      startDate: item.start.dateTime,
      endDate: item.end.dateTime,
      location: item.location?.displayName || '',
      allDay: item.isAllDay,
      recurring: item.recurrence ? 'custom' : '',
      color: '#0078d4',
      attendees: item.attendees?.map(a => a.emailAddress.address).join(', ') || '',
      externalId: item.id,
      provider: 'outlook'
    }));
  }
}
```

## Step 5: Create Unified Calendar Component

```javascript
class CalendarManager {
  constructor() {
    this.services = {
      google: new GoogleCalendarService(import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY),
      outlook: new OutlookCalendarService(this.getOutlookToken())
    };
    this.cache = new Map();
  }

  async loadAndDisplayEvents() {
    try {
      // Load configuration from Static Snack
      const config = await this.loadCalendarConfig();
      
      // Fetch events using appropriate service
      const events = await this.fetchEvents(config);
      
      // Display events
      this.displayEvents(events, config.displayName);
      
      // Set up auto-refresh
      this.scheduleRefresh(config.refreshInterval);
    } catch (error) {
      console.error('Failed to load calendar:', error);
      this.showError(error.message);
    }
  }

  async loadCalendarConfig() {
    const response = await fetch('/data/calendar-config.json');
    if (!response.ok) {
      throw new Error('Calendar configuration not found');
    }
    return response.json();
  }

  async fetchEvents(config) {
    const cacheKey = `${config.provider}-${config.calendarId}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if fresh
    if (cached && Date.now() - cached.timestamp < config.refreshInterval * 60000) {
      return cached.events;
    }

    const service = this.services[config.provider];
    if (!service) {
      throw new Error(`Provider ${config.provider} not configured`);
    }

    const events = await service.getEvents(config.calendarId, {
      maxEvents: config.maxEvents,
      daysAhead: config.daysAhead,
      showPastEvents: config.showPastEvents
    });

    // Cache the results
    this.cache.set(cacheKey, {
      events,
      timestamp: Date.now()
    });

    return events;
  }

  displayEvents(events, displayName) {
    const container = document.getElementById('calendar-events');
    if (!container) return;

    const html = `
      <h2>${displayName || 'Calendar Events'}</h2>
      <div class="events-list">
        ${events.map(event => this.renderEvent(event)).join('')}
      </div>
    `;
    
    container.innerHTML = html;
  }

  renderEvent(event) {
    const startDate = new Date(event.startDate);
    return `
      <div class="event-card" style="border-left-color: ${event.color}">
        <h3>${event.title}</h3>
        <p class="event-time">
          ${event.allDay ? 'All Day' : startDate.toLocaleString()}
        </p>
        ${event.location ? `<p class="event-location">📍 ${event.location}</p>` : ''}
        ${event.description ? `<p class="event-description">${event.description}</p>` : ''}
      </div>
    `;
  }

  scheduleRefresh(intervalMinutes) {
    setInterval(() => {
      this.loadAndDisplayEvents();
    }, intervalMinutes * 60000);
  }

  showError(message) {
    const container = document.getElementById('calendar-events');
    if (container) {
      container.innerHTML = `
        <div class="error">
          <strong>Error loading calendar:</strong> ${message}
        </div>
      `;
    }
  }

  getOutlookToken() {
    // Implement OAuth flow or retrieve stored token
    return localStorage.getItem('outlook_access_token');
  }
}

// Initialize on page load
const calendarManager = new CalendarManager();
calendarManager.loadAndDisplayEvents();
```

## Step 6: Multiple Calendar Support

To display multiple calendars, use an array configuration:

```json
[
  {
    "provider": "google",
    "calendarId": "primary",
    "displayName": "Personal"
  },
  {
    "provider": "google",
    "calendarId": "team@company.com",
    "displayName": "Team"
  },
  {
    "provider": "outlook",
    "calendarId": "calendar-id",
    "displayName": "Work"
  }
]
```

Then aggregate events:

```javascript
async loadMultipleCalendars() {
  const configs = await this.loadCalendarConfig();
  
  // Fetch all calendars in parallel
  const calendarsPromises = configs.map(config => 
    this.fetchEvents(config).then(events => ({
      ...config,
      events
    }))
  );
  
  const calendars = await Promise.all(calendarsPromises);
  
  // Merge and sort all events
  const allEvents = calendars
    .flatMap(cal => cal.events.map(e => ({ ...e, calendar: cal.displayName })))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  
  this.displayEvents(allEvents, 'All Calendars');
}
```

## Security Best Practices

1. **Never commit API keys** to git
2. **Use environment variables** for sensitive data
3. **Implement rate limiting** to avoid API quota issues
4. **Cache responses** to reduce API calls
5. **Use CORS proxies** if needed for client-side calls
6. **Implement token refresh** for OAuth flows
7. **Validate configuration** before making API calls

## Error Handling

```javascript
async fetchEventsWithRetry(config, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.fetchEvents(config);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

## Testing

```javascript
// Mock calendar config for testing
const mockConfig = {
  provider: 'google',
  calendarId: 'test@example.com',
  displayName: 'Test Calendar',
  refreshInterval: 15,
  maxEvents: 10,
  daysAhead: 30
};

// Test event fetching
const events = await calendarManager.fetchEvents(mockConfig);
console.assert(Array.isArray(events), 'Should return array of events');
console.assert(events.length <= 10, 'Should respect maxEvents');
```

## Framework Examples

### React

```jsx
function CalendarWidget() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function load() {
      const calendarConfig = await fetch('/data/calendar-config.json')
        .then(r => r.json());
      
      setConfig(calendarConfig);
      
      const calendarService = new GoogleCalendarService(
        import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY
      );
      
      const fetchedEvents = await calendarService.getEvents(
        calendarConfig.calendarId,
        calendarConfig
      );
      
      setEvents(fetchedEvents);
      setLoading(false);
    }
    
    load();
  }, []);

  if (loading) return <div>Loading calendar...</div>;

  return (
    <div>
      <h2>{config.displayName}</h2>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
```

### Vue

```vue
<template>
  <div>
    <h2>{{ config?.displayName }}</h2>
    <div v-if="loading">Loading...</div>
    <EventCard 
      v-else
      v-for="event in events" 
      :key="event.id" 
      :event="event" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const events = ref([]);
const config = ref(null);
const loading = ref(true);

onMounted(async () => {
  config.value = await fetch('/data/calendar-config.json')
    .then(r => r.json());
  
  const service = new GoogleCalendarService(
    import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY
  );
  
  events.value = await service.getEvents(
    config.value.calendarId,
    config.value
  );
  
  loading.value = false;
});
</script>
```

## Summary

1. **Static Snack** stores only the configuration (which calendar to display)
2. **Your site** handles all API calls with your own keys
3. **Content managers** can only select from providers you've configured
4. **Benefits**: More secure, more flexible, better performance

## Next Steps

- Implement error boundaries
- Add loading skeletons
- Cache with Service Workers
- Add calendar view components (month/week/day)
- Implement event filtering and search

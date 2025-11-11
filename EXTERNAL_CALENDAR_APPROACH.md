# External Calendar Integration: New Approach

## Summary

The calendar integration has been redesigned so that **Static Snack only stores configuration**, while **your static site handles all API calls** with your own API keys.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     Content Manager                              │
│                                                                   │
│  1. Opens Asset Manager in Static Snack                         │
│  2. Selects calendar provider (Google, Outlook, etc.)           │
│  3. Enters calendar ID                                           │
│  4. Sets display options (refresh interval, max events, etc.)   │
│  5. Saves configuration                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Static Snack (Configuration Only)                 │
│                                                                   │
│  Stores: data/calendar-config.json                              │
│  {                                                               │
│    "provider": "google",                                         │
│    "calendarId": "primary",                                      │
│    "displayName": "Company Calendar",                            │
│    "refreshInterval": 15,                                        │
│    "maxEvents": 100,                                             │
│    "daysAhead": 90                                               │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Your Static Site                              │
│                                                                   │
│  1. Loads calendar-config.json from repository                  │
│  2. Reads provider and calendarId                               │
│  3. Uses YOUR API keys (from .env)                              │
│  4. Makes API call to Google/Outlook/Apple                      │
│  5. Fetches events                                               │
│  6. Displays on your site                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Calendar Provider (Google, etc.)                    │
│                                                                   │
│  Returns event data directly to your site                       │
└─────────────────────────────────────────────────────────────────┘
```

## Key Points

### ✅ What Static Snack Does
- Provides UI for content managers to configure calendar settings
- Stores configuration in repository (data/calendar-config.json)
- Declares which providers are available for each site
- Shows setup instructions and documentation links

### ✅ What Static Snack Does NOT Do
- ❌ Store API keys
- ❌ Make calendar API calls
- ❌ Sync or fetch events
- ❌ Proxy requests

### ✅ What Your Site Does
- Store API keys securely (environment variables)
- Implement calendar API integration
- Fetch events from providers
- Cache responses
- Display events
- Handle errors and retries

## Setup Process

### 1. Configure Available Providers

In your `assets.config.json`, declare which providers your site has implemented:

```json
{
  "version": "1.0",
  "assets": [
    {
      "path": "data/calendar-config.json",
      "type": "calendar",
      "label": "Calendar Settings",
      "metadata": {
        "calendarType": "external",
        "availableProviders": ["google", "outlook"]
      },
      "schema": {
        "type": "object",
        "properties": {
          "provider": {
            "type": "string",
            "enum": ["google", "outlook"],
            "description": "Select calendar provider"
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
          }
        }
      }
    }
  ]
}
```

**Important**: Only list providers you've actually implemented in your site!

### 2. Set Up API Keys in Your Site

#### Google Calendar
```bash
# .env
VITE_GOOGLE_CALENDAR_API_KEY=your-api-key-here
```

Get from: https://console.cloud.google.com/

#### Microsoft Outlook
```bash
# .env
VITE_MICROSOFT_CLIENT_ID=your-client-id
VITE_MICROSOFT_CLIENT_SECRET=your-secret
```

Get from: https://portal.azure.com/

### 3. Implement Calendar Service

```javascript
// src/services/calendarService.js
class CalendarService {
  async loadConfig() {
    // Load configuration from Static Snack
    const response = await fetch('/data/calendar-config.json');
    return response.json();
  }

  async fetchEvents() {
    const config = await this.loadConfig();
    
    if (config.provider === 'google') {
      return this.fetchGoogleEvents(config);
    } else if (config.provider === 'outlook') {
      return this.fetchOutlookEvents(config);
    }
  }

  async fetchGoogleEvents(config) {
    const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
    const url = `https://www.googleapis.com/calendar/v3/calendars/${config.calendarId}/events?key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data.items;
  }

  async fetchOutlookEvents(config) {
    // Similar implementation for Outlook
  }
}
```

### 4. Content Managers Configure Calendar

1. Open Asset Manager in Static Snack
2. Click on "Calendar Settings" asset
3. Select provider from dropdown (only shows available ones)
4. Enter calendar ID
5. Set display name and options
6. Save

Configuration is stored in repository as JSON file.

### 5. Display Events on Your Site

```javascript
// Your site loads and displays events
const calendarService = new CalendarService();
const events = await calendarService.fetchEvents();

// Display however you like
events.forEach(event => {
  console.log(event.title, event.start);
});
```

## Benefits

### 🔒 Security
- Your API keys never leave your site
- No centralized key storage
- Better compliance (GDPR, SOC2, etc.)
- You control access and permissions

### ⚡ Performance
- Direct API calls (no proxy)
- You control caching strategy
- No rate limit sharing
- Better for high-traffic sites

### 🎯 Flexibility
- Implement however you want (client-side, server-side, edge functions)
- Use any framework (React, Vue, Svelte, vanilla JS)
- Custom filtering and processing
- Add your own features

### 📈 Scalability
- No bottleneck at Static Snack
- Each site's usage independent
- Better reliability
- Easier to debug

## Examples

### Example 1: Google Calendar in React

```jsx
function Calendar() {
  const [events, setEvents] = useState([]);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function load() {
      // Load config from Static Snack
      const calendarConfig = await fetch('/data/calendar-config.json')
        .then(r => r.json());
      
      setConfig(calendarConfig);
      
      // Fetch events using your API key
      const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarConfig.calendarId}/events?key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setEvents(data.items);
    }
    
    load();
  }, []);

  return (
    <div>
      <h2>{config?.displayName}</h2>
      {events.map(event => (
        <div key={event.id}>
          <h3>{event.summary}</h3>
          <p>{event.start.dateTime}</p>
        </div>
      ))}
    </div>
  );
}
```

### Example 2: Multiple Calendars

```json
// data/calendars.json
[
  {
    "provider": "google",
    "calendarId": "primary",
    "displayName": "Personal"
  },
  {
    "provider": "google",
    "calendarId": "work@company.com",
    "displayName": "Work"
  },
  {
    "provider": "outlook",
    "calendarId": "calendar-id",
    "displayName": "Meetings"
  }
]
```

```javascript
// Load and merge all calendars
const configs = await fetch('/data/calendars.json').then(r => r.json());
const allEvents = [];

for (const config of configs) {
  const events = await fetchCalendarEvents(config);
  allEvents.push(...events.map(e => ({ ...e, calendar: config.displayName })));
}

// Display combined view
displayEvents(allEvents);
```

## Documentation

### For Implementation
- **`EXTERNAL_CALENDAR_IMPLEMENTATION.md`** - Complete guide with code examples
  - Google Calendar integration
  - Outlook Calendar integration
  - Apple Calendar integration
  - Error handling and caching
  - Framework examples (React, Vue)

### For Understanding
- **`CALENDAR_ARCHITECTURE_CHANGE.md`** - Why we made this change
  - Old vs new approach
  - Migration guide
  - Benefits explained

### For Quick Start
- **`QUICK_START_CALENDAR.md`** - Get started in 5 minutes

## FAQs

**Q: Do I need to implement all providers?**  
A: No, only implement the ones you need. Just list those in `availableProviders`.

**Q: Where should I store API keys?**  
A: In environment variables (`.env` files), never commit them to git.

**Q: Can content managers see the API keys?**  
A: No, they never see or enter API keys. They only configure which calendar to display.

**Q: What if I want server-side rendering?**  
A: That works great! Fetch calendar data in your backend and pass to frontend.

**Q: Can I still use local events?**  
A: Yes, local events (array of event objects) still work exactly the same.

**Q: Do I need to update if I'm already using local events?**  
A: No, local events are unchanged. Only update if you want external calendars.

**Q: What happened to the sync-external-calendar edge function?**  
A: It's deprecated. Don't use it. Your site should make API calls directly.

**Q: Can I use this in production?**  
A: Yes! This is the recommended approach going forward.

## Next Steps

1. Read `EXTERNAL_CALENDAR_IMPLEMENTATION.md` for detailed implementation
2. Set up API keys for your chosen providers
3. Implement calendar fetching in your site
4. Add calendar asset to assets.config.json
5. Configure calendar via Asset Manager
6. Test and deploy!

---

**The key insight**: Static Snack is a content management interface, not a data proxy. Your site owns the data pipeline! 🚀

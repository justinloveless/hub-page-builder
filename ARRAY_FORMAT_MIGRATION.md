# Calendar Events: Array Format Migration

## Overview

The calendar asset type now uses an **array format** instead of an object with keyed entries. This makes the data structure more intuitive and standard for lists of events.

## What Changed

### Before (Object Format)
```json
{
  "event-id-1": {
    "title": "Team Meeting",
    "startDate": "2025-11-10T10:00:00",
    "endDate": "2025-11-10T11:00:00",
    ...
  },
  "event-id-2": {
    "title": "Product Launch",
    ...
  }
}
```

### After (Array Format)
```json
[
  {
    "id": "event-id-1",
    "title": "Team Meeting",
    "startDate": "2025-11-10T10:00:00",
    "endDate": "2025-11-10T11:00:00",
    ...
  },
  {
    "id": "event-id-2",
    "title": "Product Launch",
    ...
  }
]
```

## Key Differences

1. **Structure**: Array `[]` instead of object `{}`
2. **ID Field**: Each event now has an `id` property inside the object
3. **Iteration**: Use `.map()` instead of `Object.entries()`

## Migration Guide

### Step 1: Update Schema

In your `assets.config.json`, change:

```json
{
  "schema": {
    "type": "object",
    "additionalProperties": {
      "type": "object",
      "properties": { ... }
    }
  }
}
```

To:

```json
{
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "title": "Event ID"
        },
        ...
      }
    }
  }
}
```

### Step 2: Convert Data File

Convert your `events.json` from object to array:

**Before:**
```json
{
  "meeting-1": { "title": "Meeting" },
  "demo-2": { "title": "Demo" }
}
```

**After:**
```json
[
  { "id": "meeting-1", "title": "Meeting" },
  { "id": "demo-2", "title": "Demo" }
]
```

### Step 3: Update Code

#### Loading Events

**Before:**
```javascript
const response = await fetch('data/events.json');
const events = await response.json();
const eventArray = Object.entries(events).map(([id, event]) => ({
  id,
  ...event
}));
```

**After:**
```javascript
const response = await fetch('data/events.json');
const events = await response.json();
// Already an array!
```

#### Filtering Events

**Before:**
```javascript
const upcoming = Object.entries(events)
  .filter(([_, event]) => new Date(event.startDate) > now)
  .map(([id, event]) => ({ id, ...event }));
```

**After:**
```javascript
const upcoming = events.filter(event => 
  new Date(event.startDate) > now
);
```

#### Finding an Event

**Before:**
```javascript
const event = events[eventId];
```

**After:**
```javascript
const event = events.find(e => e.id === eventId);
```

#### Adding an Event

**Before:**
```javascript
events[newEventId] = newEvent;
```

**After:**
```javascript
events.push({ id: newEventId, ...newEvent });
```

#### Removing an Event

**Before:**
```javascript
delete events[eventId];
```

**After:**
```javascript
const index = events.findIndex(e => e.id === eventId);
if (index !== -1) events.splice(index, 1);
```

## Benefits of Array Format

1. **Standard JSON Practice**: Arrays are more conventional for lists
2. **Simpler Iteration**: Direct use of array methods (`.map`, `.filter`, `.find`)
3. **Order Preservation**: Arrays maintain insertion order naturally
4. **Type Safety**: Better TypeScript support with `CalendarEvent[]`
5. **Framework Friendly**: Works better with React, Vue, etc.

## Automated Conversion Script

If you have existing event data, use this script to convert:

```javascript
// convert-to-array.js
const fs = require('fs');

// Read old format
const oldData = JSON.parse(fs.readFileSync('events.json', 'utf8'));

// Convert to array
const newData = Object.entries(oldData).map(([id, event]) => ({
  id,
  ...event
}));

// Write new format
fs.writeFileSync('events-new.json', JSON.stringify(newData, null, 2));
console.log(`Converted ${newData.length} events to array format`);
```

Run with:
```bash
node convert-to-array.js
```

## TypeScript Interface

Updated interface:

```typescript
interface CalendarEvent {
  id: string;        // Now a required property
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  allDay?: boolean;
  recurring?: string;
  color?: string;
  attendees?: string;
  externalId?: string;
  synced?: boolean;
}

// Use as array
const events: CalendarEvent[] = [...];
```

## All Files Updated

The following files have been updated to use array format:

✅ **Examples:**
- `examples/calendar-assets-config.json`
- `examples/sample-events.json`
- `examples/calendar-display-example.html`

✅ **Components:**
- `src/components/CalendarAssetManager.tsx`

✅ **Backend:**
- `supabase/functions/sync-external-calendar/index.ts`

✅ **Documentation:**
- `CALENDAR_ASSETS_GUIDE.md`
- `CALENDAR_IMPLEMENTATION_SUMMARY.md`
- `QUICK_START_CALENDAR.md`
- `README_CALENDAR_FEATURE.md`

## Testing Your Migration

1. **Validate JSON**: Use `jq` or online JSON validator
   ```bash
   cat events.json | jq '.'
   ```

2. **Check Type**: Ensure it's an array
   ```javascript
   const events = require('./events.json');
   console.log(Array.isArray(events)); // Should be true
   ```

3. **Verify IDs**: All events have ID field
   ```javascript
   events.every(e => e.id); // Should be true
   ```

4. **Test Loading**: Load in your app and check console

## Common Issues

### Issue: `Object.entries is not a function`
**Cause**: Trying to use object methods on array
**Fix**: Use array methods (`.map`, `.filter`)

### Issue: `Cannot read property 'title' of undefined`
**Cause**: Direct property access like `events[id]`
**Fix**: Use `.find()` instead: `events.find(e => e.id === id)`

### Issue: Events not displaying
**Cause**: Schema still set to "object" type
**Fix**: Update schema to use "array" with "items"

## Questions?

See the main documentation:
- `CALENDAR_ASSETS_GUIDE.md` - Complete guide
- `QUICK_START_CALENDAR.md` - Quick setup

The array format is now the standard for all calendar events! 🎉

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  site_id: string;
  provider: 'google' | 'apple' | 'outlook';
  calendar_id: string;
  api_key?: string;
  access_token?: string;
  asset_path: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  allDay?: boolean;
  recurring?: string;
  color?: string;
  attendees?: string;
  externalId: string;
  synced: boolean;
}

async function syncGoogleCalendar(calendarId: string, apiKey: string): Promise<CalendarEvent[]> {
  // Google Calendar API v3
  const now = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${now}&maxResults=100&singleEvents=true&orderBy=startTime`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Calendar API error: ${error}`);
  }
  
  const data = await response.json();
  const events: CalendarEvent[] = [];
  
  for (const item of data.items || []) {
    events.push({
      id: `google-${item.id}`,
      title: item.summary || 'Untitled Event',
      description: item.description || '',
      startDate: item.start.dateTime || item.start.date,
      endDate: item.end.dateTime || item.end.date,
      location: item.location || '',
      allDay: !item.start.dateTime,
      recurring: item.recurrence ? 'custom' : '',
      color: item.colorId || '#3b82f6',
      attendees: item.attendees?.map((a: any) => a.email).join(', ') || '',
      externalId: item.id,
      synced: true
    });
  }
  
  return events;
}

async function syncOutlookCalendar(calendarId: string, accessToken: string): Promise<CalendarEvent[]> {
  // Microsoft Graph API
  const now = new Date().toISOString();
  const url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events?$filter=start/dateTime ge '${now}'&$top=100&$orderby=start/dateTime`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft Graph API error: ${error}`);
  }
  
  const data = await response.json();
  const events: CalendarEvent[] = [];
  
  for (const item of data.value || []) {
    events.push({
      id: `outlook-${item.id}`,
      title: item.subject || 'Untitled Event',
      description: item.bodyPreview || '',
      startDate: item.start.dateTime,
      endDate: item.end.dateTime,
      location: item.location?.displayName || '',
      allDay: item.isAllDay,
      recurring: item.recurrence ? 'custom' : '',
      color: item.categories?.[0] || '#3b82f6',
      attendees: item.attendees?.map((a: any) => a.emailAddress.address).join(', ') || '',
      externalId: item.id,
      synced: true
    });
  }
  
  return events;
}

async function syncAppleCalendar(calendarId: string, username: string, password: string): Promise<CalendarEvent[]> {
  // CalDAV protocol for iCloud
  // This is a simplified implementation - full CalDAV support would require more complex parsing
  const url = `https://caldav.icloud.com/${username}/calendars/${calendarId}`;
  
  const response = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      'Content-Type': 'application/xml',
      'Depth': '1'
    },
    body: `<?xml version="1.0" encoding="utf-8" ?>
      <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
        <D:prop>
          <D:getetag/>
          <C:calendar-data/>
        </D:prop>
        <C:filter>
          <C:comp-filter name="VCALENDAR">
            <C:comp-filter name="VEVENT"/>
          </C:comp-filter>
        </C:filter>
      </C:calendar-query>`
  });
  
  if (!response.ok) {
    throw new Error(`Apple Calendar CalDAV error: ${response.statusText}`);
  }
  
  // Parse iCal format events from response
  // This is a placeholder - you'd need a proper iCal parser
  const events: CalendarEvent[] = [];
  return events;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { site_id, provider, calendar_id, api_key, access_token, asset_path }: SyncRequest = await req.json();

    // Verify user has access to the site
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('*')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return new Response(JSON.stringify({ error: 'Site not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync calendar based on provider
    let events: CalendarEvent[] = [];
    
    try {
      switch (provider) {
        case 'google':
          if (!api_key) throw new Error('API key required for Google Calendar');
          events = await syncGoogleCalendar(calendar_id, api_key);
          break;
        
        case 'outlook':
          if (!access_token) throw new Error('Access token required for Outlook Calendar');
          events = await syncOutlookCalendar(calendar_id, access_token);
          break;
        
        case 'apple':
          if (!api_key) throw new Error('App-specific password required for Apple Calendar');
          // Parse username from calendar_id or require it separately
          const username = user.email || '';
          events = await syncAppleCalendar(calendar_id, username, api_key);
          break;
        
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error: any) {
      console.error('Calendar sync error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to sync calendar',
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return synced events
    return new Response(JSON.stringify({ 
      success: true,
      events,
      count: events.length,
      lastSync: new Date().toISOString(),
      provider,
      calendarId: calendar_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

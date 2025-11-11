import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, ExternalLink, Info, Calendar, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface CalendarAssetManagerProps {
  siteId: string;
  assetPath: string;
  assetConfig: any;
  onUpdate?: () => void;
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
  externalId?: string;
  synced?: boolean;
}

const CalendarAssetManager = ({ siteId, assetPath, assetConfig, onUpdate }: CalendarAssetManagerProps) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const availableProviders = assetConfig?.metadata?.availableProviders || [];
  const calendarType = assetConfig?.metadata?.calendarType || 'local';

  useEffect(() => {
    // Load any existing event data for preview
    loadEventData();
  }, [assetPath]);

  const loadEventData = async () => {
    // This is just for preview - the actual site will fetch from calendar APIs
    try {
      const response = await fetch(assetPath);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setEvents(data);
        }
      }
    } catch (error) {
      console.log('No preview data available');
    }
  };

  const handleExportEvents = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calendar-events-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getProviderInfo = (provider: string) => {
    const info = {
      google: {
        name: 'Google Calendar',
        docs: 'https://developers.google.com/calendar',
        setup: 'Requires API key from Google Cloud Console'
      },
      outlook: {
        name: 'Microsoft Outlook/365',
        docs: 'https://learn.microsoft.com/en-us/graph/api/resources/calendar',
        setup: 'Requires OAuth 2.0 authentication'
      },
      apple: {
        name: 'Apple Calendar (iCloud)',
        docs: 'https://developer.apple.com/documentation/calendarstore',
        setup: 'Requires app-specific password'
      }
    };
    return info[provider as keyof typeof info];
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500" />
            <CardTitle>Calendar Configuration</CardTitle>
          </div>
          <CardDescription>
            {calendarType === 'external' 
              ? 'Configure which external calendar to display on your site'
              : 'Manage local calendar events stored in your repository'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calendarType === 'external' ? (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>External Calendar Configuration</AlertTitle>
                <AlertDescription>
                  Use the Asset Manager's editor to configure which calendar your site should display.
                  Your static site will fetch events directly from the calendar provider using your own API keys.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Available Providers</h3>
                  {availableProviders.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {availableProviders.map((provider: string) => {
                        const info = getProviderInfo(provider);
                        return (
                          <Badge key={provider} variant="outline" className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {info?.name || provider}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No providers configured. Add providers to the <code>availableProviders</code> metadata.
                    </p>
                  )}
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>How It Works</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-xs">
                      1. <strong>Configure in Asset Manager:</strong> Set which calendar to display (provider, calendar ID, settings)
                    </p>
                    <p className="text-xs">
                      2. <strong>Your site handles API calls:</strong> Fetch events using your own API keys
                    </p>
                    <p className="text-xs">
                      3. <strong>Display events:</strong> Render calendar data on your site
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Provider Setup Instructions</h3>
                  <div className="space-y-3">
                    {availableProviders.map((provider: string) => {
                      const info = getProviderInfo(provider);
                      if (!info) return null;
                      return (
                        <div key={provider} className="p-3 border rounded-lg bg-accent/5">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{info.name}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(info.docs, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Docs
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">{info.setup}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Local Calendar Events</AlertTitle>
                <AlertDescription>
                  Manage events stored directly in your repository. Use the Asset Manager's
                  JSON editor to add, edit, or remove events.
                </AlertDescription>
              </Alert>

              {events.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {events.length} event{events.length !== 1 ? 's' : ''} configured
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportEvents}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              )}

              {events.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {events.map((event) => (
                    <div key={event.id} className="p-3 border rounded-lg hover:bg-accent/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{event.title}</h4>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {event.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                            <span>📅 {new Date(event.startDate).toLocaleDateString()}</span>
                            {event.location && <span>📍 {event.location}</span>}
                            {event.allDay && <Badge variant="secondary">All Day</Badge>}
                            {event.recurring && <Badge variant="secondary">Recurring</Badge>}
                          </div>
                        </div>
                        {event.color && (
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0 ml-2"
                            style={{ backgroundColor: event.color }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Implementation Guide</AlertTitle>
        <AlertDescription>
          {calendarType === 'external' ? (
            <>
              See <a href="/EXTERNAL_CALENDAR_IMPLEMENTATION.md" className="underline font-medium" target="_blank">
                External Calendar Implementation Guide
              </a> for complete setup instructions with code examples for your static site.
            </>
          ) : (
            <>
              Check out the <a href="/CALENDAR_ASSETS_GUIDE.md" className="underline font-medium" target="_blank">
                Calendar Assets Guide
              </a> for detailed setup instructions, examples, and best practices.
            </>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default CalendarAssetManager;

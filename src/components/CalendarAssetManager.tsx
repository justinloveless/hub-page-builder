import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, RefreshCw, Download, Upload, ExternalLink, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CalendarAssetManagerProps {
  siteId: string;
  assetPath: string;
  assetConfig: any;
  onUpdate?: () => void;
}

interface CalendarEvent {
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
  const [syncing, setSyncing] = useState(false);
  const [events, setEvents] = useState<Record<string, CalendarEvent>>({});
  const [lastSync, setLastSync] = useState<string | null>(null);
  
  // External calendar config
  const [provider, setProvider] = useState<'local' | 'google' | 'apple' | 'outlook'>('local');
  const [calendarId, setCalendarId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const handleSyncExternal = async () => {
    if (!calendarId) {
      toast.error('Please enter a calendar ID');
      return;
    }

    if (provider === 'google' && !apiKey) {
      toast.error('Please enter an API key for Google Calendar');
      return;
    }

    if (provider === 'outlook' && !accessToken) {
      toast.error('Please enter an access token for Outlook Calendar');
      return;
    }

    if (provider === 'apple' && !apiKey) {
      toast.error('Please enter an app-specific password for Apple Calendar');
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-external-calendar', {
        body: {
          site_id: siteId,
          provider,
          calendar_id: calendarId,
          api_key: apiKey || undefined,
          access_token: accessToken || undefined,
          asset_path: assetPath
        }
      });

      if (error) throw error;

      setEvents(data.events);
      setLastSync(data.lastSync);
      toast.success(`Successfully synced ${data.count} events from ${provider} calendar`);
      
      if (onUpdate) onUpdate();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Failed to sync calendar');
    } finally {
      setSyncing(false);
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
    toast.success('Events exported successfully');
  };

  const handleImportEvents = async (file: File) => {
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      setEvents(imported);
      toast.success('Events imported successfully');
    } catch (error) {
      toast.error('Failed to import events - invalid JSON format');
    }
  };

  const getProviderDocs = () => {
    const docs = {
      google: {
        title: 'Google Calendar Setup',
        steps: [
          'Go to Google Cloud Console',
          'Create a project and enable Calendar API',
          'Create API key or OAuth 2.0 credentials',
          'Enter your calendar ID (usually your email or "primary")'
        ],
        link: 'https://console.cloud.google.com/'
      },
      apple: {
        title: 'Apple Calendar (iCloud) Setup',
        steps: [
          'Go to appleid.apple.com',
          'Generate an app-specific password',
          'Use your Apple ID as username',
          'Calendar ID is typically "home" or found in Calendar.app settings'
        ],
        link: 'https://appleid.apple.com/'
      },
      outlook: {
        title: 'Outlook Calendar Setup',
        steps: [
          'Register app in Azure Portal',
          'Get application ID and secret',
          'Request calendar.read permissions',
          'Generate access token using OAuth 2.0'
        ],
        link: 'https://portal.azure.com/'
      }
    };
    return docs[provider as keyof typeof docs];
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              <CardTitle>Calendar Asset Manager</CardTitle>
            </div>
            {lastSync && (
              <Badge variant="outline" className="text-xs">
                Last sync: {new Date(lastSync).toLocaleString()}
              </Badge>
            )}
          </div>
          <CardDescription>
            Manage local calendar events or sync with external calendar providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="local">Local Events</TabsTrigger>
              <TabsTrigger value="sync">External Sync</TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Local Calendar Events</AlertTitle>
                <AlertDescription>
                  Manage events stored directly in your repository. Use the Asset Manager's
                  JSON editor to add, edit, or remove events.
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportEvents}
                  disabled={Object.keys(events).length === 0}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Events
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportEvents(file);
                    };
                    input.click();
                  }}
                  className="flex-1"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import Events
                </Button>
              </div>

              {Object.keys(events).length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(events).map(([id, event]) => (
                    <div key={id} className="p-3 border rounded-lg hover:bg-accent/50">
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
            </TabsContent>

            <TabsContent value="sync" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Calendar Provider</Label>
                  <Select
                    value={provider}
                    onValueChange={(value: any) => setProvider(value)}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local Only</SelectItem>
                      <SelectItem value="google">Google Calendar</SelectItem>
                      <SelectItem value="apple">Apple Calendar (iCloud)</SelectItem>
                      <SelectItem value="outlook">Outlook Calendar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {provider !== 'local' && (
                  <>
                    {getProviderDocs() && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle className="flex items-center justify-between">
                          {getProviderDocs()!.title}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(getProviderDocs()!.link, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </AlertTitle>
                        <AlertDescription>
                          <ol className="list-decimal list-inside space-y-1 text-xs mt-2">
                            {getProviderDocs()!.steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="calendar-id">Calendar ID</Label>
                      <Input
                        id="calendar-id"
                        value={calendarId}
                        onChange={(e) => setCalendarId(e.target.value)}
                        placeholder={
                          provider === 'google' ? 'primary or email@gmail.com' :
                          provider === 'apple' ? 'home' :
                          'calendar-id'
                        }
                      />
                    </div>

                    {provider === 'google' && (
                      <div className="space-y-2">
                        <Label htmlFor="api-key">API Key</Label>
                        <Input
                          id="api-key"
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Your Google Calendar API key"
                        />
                      </div>
                    )}

                    {provider === 'apple' && (
                      <div className="space-y-2">
                        <Label htmlFor="app-password">App-Specific Password</Label>
                        <Input
                          id="app-password"
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Your iCloud app-specific password"
                        />
                      </div>
                    )}

                    {provider === 'outlook' && (
                      <div className="space-y-2">
                        <Label htmlFor="access-token">Access Token</Label>
                        <Input
                          id="access-token"
                          type="password"
                          value={accessToken}
                          onChange={(e) => setAccessToken(e.target.value)}
                          placeholder="Microsoft Graph API access token"
                        />
                      </div>
                    )}

                    <Button
                      onClick={handleSyncExternal}
                      disabled={syncing}
                      className="w-full"
                    >
                      {syncing ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync Calendar
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Need Help?</AlertTitle>
        <AlertDescription>
          Check out the <a href="/CALENDAR_ASSETS_GUIDE.md" className="underline" target="_blank">
            Calendar Assets Guide
          </a> for detailed setup instructions, examples, and best practices.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default CalendarAssetManager;

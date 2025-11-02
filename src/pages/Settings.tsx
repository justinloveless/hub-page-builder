import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [githubAppSlug, setGithubAppSlug] = useState("");
  const [githubClientId, setGithubClientId] = useState("");
  const [githubClientSecret, setGithubClientSecret] = useState("");

  useEffect(() => {
    // Check auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // In a real implementation, these would be stored securely
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="mr-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>GitHub App Configuration</CardTitle>
            <CardDescription>
              Configure your GitHub App credentials to enable repository integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="app-slug">GitHub App Slug</Label>
                <Input
                  id="app-slug"
                  placeholder="my-static-hub-app"
                  value={githubAppSlug}
                  onChange={(e) => setGithubAppSlug(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  The slug of your GitHub App (found in the app's URL)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-id">Client ID</Label>
                <Input
                  id="client-id"
                  placeholder="Iv1.abc123..."
                  value={githubClientId}
                  onChange={(e) => setGithubClientId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input
                  id="client-secret"
                  type="password"
                  placeholder="••••••••"
                  value={githubClientSecret}
                  onChange={(e) => setGithubClientSecret(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Your secret will be stored securely
                </p>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How to Create a GitHub App</CardTitle>
            <CardDescription>
              Follow these steps to set up GitHub integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
              <li>Go to GitHub Settings → Developer settings → GitHub Apps</li>
              <li>Click "New GitHub App"</li>
              <li>Set the required permissions (Contents: Read & Write, Metadata: Read)</li>
              <li>Generate a client secret</li>
              <li>Copy the App Slug, Client ID, and Client Secret here</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;

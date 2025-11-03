import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{
    slug: string;
    app_id: string;
    client_id: string;
  } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      // Check auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user is admin
      const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (roleError) {
        console.error("Error checking admin role:", roleError);
        toast.error("Failed to verify permissions");
        navigate("/dashboard");
        return;
      }

      if (!isAdmin) {
        toast.error("You don't have permission to access this page");
        navigate("/dashboard");
        return;
      }

      // Fetch GitHub app config
      const { data, error } = await supabase
        .from("github_app_public_config")
        .select("*")
        .maybeSingle();

      if (error) {
        toast.error("Failed to load GitHub app configuration");
        console.error(error);
      } else if (data) {
        setConfig({
          slug: data.slug,
          app_id: data.app_id,
          client_id: data.client_id,
        });
      }
      
      setLoading(false);
    };

    fetchConfig();
  }, [navigate]);

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
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>GitHub App Configuration</CardTitle>
                <CardDescription>
                  System-managed GitHub App credentials (read-only)
                </CardDescription>
              </div>
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ) : config ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">GitHub App Slug</p>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md font-mono">
                    {config.slug}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">App ID</p>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md font-mono">
                    {config.app_id || "Not configured"}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Client ID</p>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md font-mono">
                    {config.client_id}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Client Secret</p>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md font-mono">
                    ••••••••••••••••
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Client secret is stored securely and cannot be displayed
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Private Key</p>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md font-mono">
                    ••••••••••••••••
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Private key is stored in Supabase secrets (GITHUB_APP_PKEY) and cannot be displayed
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-4">
                  <p className="text-sm text-blue-300">
                    <strong>Note:</strong> This configuration is managed by system administrators.
                    Contact your administrator if changes are needed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-4">
                <p className="text-sm text-yellow-300">
                  No GitHub App configuration found. Please contact your system administrator to set up the GitHub App credentials.
                </p>
              </div>
            )}
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
              <li>Generate a client secret and a private key</li>
              <li>Note the App ID from the GitHub App settings</li>
              <li>Add the App ID to github_app_config table, store the private key in GITHUB_APP_PKEY secret</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;

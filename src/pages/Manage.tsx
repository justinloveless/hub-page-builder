import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, GitBranch, Users, FileText, Activity } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Site = Tables<"sites">;
type AssetVersion = Tables<"asset_versions">;
type ActivityLog = Tables<"activity_log">;
type SiteMember = Tables<"site_members">;

const Manage = () => {
  const navigate = useNavigate();
  const { siteId } = useParams<{ siteId: string }>();
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<Site | null>(null);
  const [assets, setAssets] = useState<AssetVersion[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<SiteMember[]>([]);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      if (siteId) {
        await Promise.all([
          loadSite(),
          loadAssets(),
          loadActivities(),
          loadMembers(),
        ]);
      }
      setLoading(false);
    };

    checkAuthAndLoad();
  }, [siteId, navigate]);

  const loadSite = async () => {
    if (!siteId) return;
    
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .eq("id", siteId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Site not found");
        navigate("/dashboard");
        return;
      }
      setSite(data);
    } catch (error: any) {
      toast.error("Failed to load site");
      console.error(error);
    }
  };

  const loadAssets = async () => {
    if (!siteId) return;
    
    try {
      const { data, error } = await supabase
        .from("asset_versions")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setAssets(data || []);
    } catch (error: any) {
      console.error("Failed to load assets:", error);
    }
  };

  const loadActivities = async () => {
    if (!siteId) return;
    
    try {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error("Failed to load activities:", error);
    }
  };

  const loadMembers = async () => {
    if (!siteId) return;
    
    try {
      const { data, error } = await supabase
        .from("site_members")
        .select("*")
        .eq("site_id", siteId);

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      console.error("Failed to load members:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Skeleton className="h-8 w-8 rounded mr-4" />
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-32 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Site not found</h2>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

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
          <div className="flex-1">
            <h1 className="text-xl font-bold">{site.name}</h1>
            <p className="text-sm text-muted-foreground">{site.repo_full_name}</p>
          </div>
          <Button variant="outline" size="sm">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Site
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Site Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Site Details</CardTitle>
            <CardDescription>General information about this site</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium mb-1">Repository</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {site.repo_full_name}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Default Branch</p>
                <Badge variant="secondary" className="mt-1">
                  <GitBranch className="mr-1 h-3 w-3" />
                  {site.default_branch}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Created</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(site.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="assets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="assets">
              <FileText className="mr-2 h-4 w-4" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="mr-2 h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="mr-2 h-4 w-4" />
              Members
            </TabsTrigger>
          </TabsList>

          {/* Assets Tab */}
          <TabsContent value="assets">
            <Card>
              <CardHeader>
                <CardTitle>Asset Versions</CardTitle>
                <CardDescription>
                  Recent asset uploads and versions for this site
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No assets found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{asset.repo_path}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {asset.storage_path}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={asset.status === "active" ? "default" : "secondary"}>
                            {asset.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {(asset.file_size_bytes / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                  Recent actions and events for this site
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-4 p-4 border border-border rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Activity className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{activity.action}</p>
                          {activity.metadata && typeof activity.metadata === 'object' && (
                            <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                              {JSON.stringify(activity.metadata, null, 2)}
                            </pre>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(activity.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Site Members</CardTitle>
                <CardDescription>
                  Users who have access to manage this site
                </CardDescription>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No members found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div
                        key={`${member.site_id}-${member.user_id}`}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <span className="text-primary-foreground font-semibold text-sm">
                              {member.user_id.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">User ID: {member.user_id.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground">
                              Added {new Date(member.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">{member.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Manage;

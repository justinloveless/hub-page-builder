import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, GitBranch, Users, Activity, Copy, Trash2, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import InviteMemberDialog from "@/components/InviteMemberDialog";
import type { Tables } from "@/integrations/supabase/types";

type Site = Tables<"sites">;
type ActivityLog = Tables<"activity_log">;
type SiteMember = Tables<"site_members">;
type Profile = Tables<"profiles">;
type Invitation = Tables<"invitations">;

interface MemberWithProfile extends SiteMember {
  profile?: Profile | null;
}

const Manage = () => {
  const navigate = useNavigate();
  const { siteId } = useParams<{ siteId: string }>();
  const [loading, setLoading] = useState(true);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // Get current user's role
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const currentUserRole = members.find(m => m.user_id === currentUserId)?.role || null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });
  }, []);

  // Generate URLs from repo_full_name
  const getGithubPagesUrl = (repoFullName: string) => {
    const [username, repoName] = repoFullName.split('/');
    return `https://${username}.github.io/${repoName}/`;
  };

  const getRepositoryUrl = (repoFullName: string) => {
    return `https://github.com/${repoFullName}`;
  };

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
          loadActivities(),
          loadMembers(),
          loadInvitations(),
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
      // First get site members
      const { data: membersData, error: membersError } = await supabase
        .from("site_members")
        .select("*")
        .eq("site_id", siteId);

      if (membersError) throw membersError;

      // Then get profiles for each member
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        if (profilesError) {
          console.error("Failed to load profiles:", profilesError);
        }

        // Merge profiles with members
        const membersWithProfiles = membersData.map(member => ({
          ...member,
          profile: profilesData?.find(p => p.id === member.user_id) || null
        }));

        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      console.error("Failed to load members:", error);
    }
  };

  const loadInvitations = async () => {
    if (!siteId) return;
    
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("site_id", siteId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error("Failed to load invitations:", error);
    }
  };

  const handleCopyInviteLink = async (token: string, inviteId: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInviteId(inviteId);
      toast.success("Invite link copied to clipboard!");
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", invitationId);

      if (error) throw error;
      
      toast.success("Invitation deleted");
      loadInvitations();
    } catch (error: any) {
      console.error("Failed to delete invitation:", error);
      toast.error("Failed to delete invitation");
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
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(getGithubPagesUrl(site.repo_full_name), '_blank')}
          >
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
                <button
                  onClick={() => window.open(getRepositoryUrl(site.repo_full_name), '_blank')}
                  className="text-sm text-muted-foreground flex items-center gap-2 hover:text-primary transition-colors cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                  {site.repo_full_name}
                </button>
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
        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
            <TabsTrigger value="activity">
              <Activity className="mr-2 h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="mr-2 h-4 w-4" />
              Members
            </TabsTrigger>
          </TabsList>

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
                            <div className="space-y-1 mt-1">
                              {(activity.metadata as any).pr_url && (
                                <a
                                  href={(activity.metadata as any).pr_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View PR #{(activity.metadata as any).pr_number}
                                </a>
                              )}
                              {(activity.metadata as any).commit_sha && site && (
                                <a
                                  href={`https://github.com/${site.repo_full_name}/commit/${(activity.metadata as any).commit_sha}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View commit {(activity.metadata as any).commit_sha.substring(0, 7)}
                                </a>
                              )}
                              <pre className="text-xs text-muted-foreground overflow-x-auto">
                                {JSON.stringify(activity.metadata, null, 2)}
                              </pre>
                            </div>
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
          <TabsContent value="members" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Site Members</CardTitle>
                    <CardDescription>
                      Users who have access to manage this site
                    </CardDescription>
                  </div>
                  <InviteMemberDialog siteId={siteId!} onInviteCreated={loadInvitations} />
                </div>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No members found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => {
                      const displayName = member.profile?.full_name || `User ${member.user_id.slice(0, 8)}`;
                      const initials = member.profile?.full_name
                        ? member.profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        : member.user_id.slice(0, 2).toUpperCase();
                      
                      return (
                        <div
                          key={`${member.site_id}-${member.user_id}`}
                          className="flex items-center justify-between p-4 border border-border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.profile?.avatar_url || undefined} alt={displayName} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                Added {new Date(member.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">{member.role}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Invitations</CardTitle>
                  <CardDescription>
                    Invitations waiting to be accepted
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {invitation.email || "Invitation link"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{invitation.role}</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopyInviteLink(invitation.token, invitation.id)}
                            title="Copy invite link"
                          >
                            {copiedInviteId === invitation.id ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          {currentUserRole === "owner" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteInvitation(invitation.id)}
                              title="Delete invitation"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Manage;

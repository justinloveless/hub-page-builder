import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, GitBranch, Users, FileText, Activity, Copy, Trash2, Check, User as UserIcon, Settings, UserCog, Crown, LogOut, Filter, CalendarIcon, X, Package, GitCommit } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AssetManagerSidebar from "@/components/AssetManagerSidebar";
import PendingBatchChanges from "@/components/PendingBatchChanges";
import InviteMemberDialog from "@/components/InviteMemberDialog";
import ActivityCard from "@/components/ActivityCard";
import { SitePreview } from "@/components/SitePreview";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { Tables } from "@/integrations/supabase/types";

export interface PendingAssetChange {
  repoPath: string;
  content: string;
  originalContent?: string;
  fileName: string;
}

type Site = Tables<"sites">;
type ActivityLog = Tables<"activity_log">;
type SiteMember = Tables<"site_members">;
type Profile = Tables<"profiles">;
type Invitation = Tables<"invitations">;

interface MemberWithProfile extends SiteMember {
  profile?: Profile | null;
}

interface ActivityWithProfile extends ActivityLog {
  user_profile?: Profile | null;
}

const Manage = () => {
  const navigate = useNavigate();
  const { siteId } = useParams<{ siteId: string }>();
  const [loading, setLoading] = useState(true);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [activities, setActivities] = useState<ActivityWithProfile[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveAction, setLeaveAction] = useState<'leave' | 'delete' | null>(null);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<PendingAssetChange[]>([]);
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);
  const ACTIVITIES_PER_PAGE = 10;

  // Activity filters
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);

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

  const loadActivities = async (page: number = 1, append: boolean = false) => {
    if (!siteId) return;

    try {
      const from = (page - 1) * ACTIVITIES_PER_PAGE;
      const to = from + ACTIVITIES_PER_PAGE - 1;

      let query = supabase
        .from("activity_log")
        .select("*")
        .eq("site_id", siteId);

      // Apply user filter
      if (filterUserId && filterUserId !== "all") {
        query = query.eq("user_id", filterUserId);
      }

      // Apply date filters
      if (filterDateFrom) {
        query = query.gte("created_at", filterDateFrom.toISOString());
      }
      if (filterDateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(filterDateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt("created_at", endDate.toISOString());
      }

      const { data: activitiesData, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch profiles for activities
      const userIds = [...new Set(activitiesData?.map(a => a.user_id).filter(Boolean) || [])];
      let profilesMap: Record<string, Profile> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as Record<string, Profile>);
        }
      }

      const activitiesWithProfiles: ActivityWithProfile[] = (activitiesData || []).map(activity => ({
        ...activity,
        user_profile: activity.user_id ? profilesMap[activity.user_id] : null
      }));

      setHasMoreActivities(activitiesWithProfiles.length === ACTIVITIES_PER_PAGE);

      if (append) {
        setActivities(prev => [...prev, ...activitiesWithProfiles]);
      } else {
        setActivities(activitiesWithProfiles);
      }
    } catch (error: any) {
      console.error("Failed to load activities:", error);
    }
  };

  const loadMoreActivities = async () => {
    const nextPage = activitiesPage + 1;
    setActivitiesPage(nextPage);
    await loadActivities(nextPage, true);
  };

  const handleFilterChange = () => {
    setActivitiesPage(1);
    loadActivities(1, false);
  };

  const clearFilters = () => {
    setFilterUserId("all");
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  useEffect(() => {
    if (siteId) {
      handleFilterChange();
    }
  }, [filterUserId, filterDateFrom, filterDateTo]);

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
    if (!confirm(`Are you sure you want to delete this invitation?`)) return;

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

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this site?`)) return;

    try {
      const { error } = await supabase
        .from("site_members")
        .delete()
        .eq("site_id", siteId)
        .eq("user_id", memberUserId);

      if (error) throw error;

      toast.success("Member removed successfully");
      loadMembers();
    } catch (error: any) {
      console.error("Failed to remove member:", error);
      toast.error(error.message || "Failed to remove member");
    }
  };

  const handlePromoteToOwner = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to promote ${memberName} to owner? This will give them full control over the site.`)) return;

    try {
      const { error } = await supabase
        .from("site_members")
        .update({ role: "owner" })
        .eq("site_id", siteId)
        .eq("user_id", memberUserId);

      if (error) throw error;

      toast.success(`${memberName} promoted to owner`);
      loadMembers();
    } catch (error: any) {
      console.error("Failed to promote member:", error);
      toast.error(error.message || "Failed to promote member");
    }
  };

  const handleLeaveSite = async () => {
    if (!currentUserId || !siteId) return;

    try {
      const owners = members.filter(m => m.role === 'owner');
      const managers = members.filter(m => m.role === 'manager');
      const isOwner = currentUserRole === 'owner';
      const isLastOwner = isOwner && owners.length === 1;
      const isLastMember = members.length === 1;

      // If last member, delete the site
      if (isLastMember) {
        setLeaveAction('delete');
        setShowLeaveDialog(true);
        return;
      }

      // If last owner with managers, promote a manager first
      if (isLastOwner && managers.length > 0) {
        const firstManager = managers[0];
        await supabase
          .from("site_members")
          .update({ role: "owner" })
          .eq("site_id", siteId)
          .eq("user_id", firstManager.user_id);

        toast.success(`${firstManager.profile?.full_name || 'Manager'} promoted to owner`);
      }

      setLeaveAction('leave');
      setShowLeaveDialog(true);
    } catch (error: any) {
      console.error("Failed to process leave request:", error);
      toast.error("Failed to leave site");
    }
  };

  const confirmLeaveSite = async () => {
    if (!currentUserId || !siteId) return;

    try {
      if (leaveAction === 'delete') {
        // Delete the site
        const { error } = await supabase
          .from("sites")
          .delete()
          .eq("id", siteId);

        if (error) throw error;
        toast.success("Site deleted successfully");
      } else {
        // Just remove membership
        const { error } = await supabase
          .from("site_members")
          .delete()
          .eq("site_id", siteId)
          .eq("user_id", currentUserId);

        if (error) throw error;
        toast.success("Left site successfully");
      }

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Failed to leave site:", error);
      toast.error(error.message || "Failed to leave site");
    } finally {
      setShowLeaveDialog(false);
      setLeaveAction(null);
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
    <div className="min-h-screen w-full flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate">{site.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{site.repo_full_name}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/profile")}
                title="Profile"
              >
                <UserIcon className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLeaveSite}
                title="Leave Site"
              >
                <LogOut className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(getGithubPagesUrl(site.repo_full_name), '_blank')}
                className="hidden sm:flex"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Site
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(getGithubPagesUrl(site.repo_full_name), '_blank')}
                className="sm:hidden"
                title="View Site"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Sidebar */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="overflow-hidden">
          <div className="h-full flex flex-col min-w-0 border-r overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Site Details */}
              <div className="space-y-3 w-full">
                <h3 className="text-sm font-semibold">Site Details</h3>
                <div className="space-y-2 text-xs">
                  <div className="w-full">
                    <p className="text-muted-foreground mb-1">Repository</p>
                    <button
                      onClick={() => window.open(getRepositoryUrl(site.repo_full_name), '_blank')}
                      className="text-primary hover:underline flex items-center gap-1 w-full max-w-full"
                    >
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate min-w-0 flex-1">{site.repo_full_name}</span>
                    </button>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Branch</p>
                    <Badge variant="secondary" className="text-xs">
                      <GitBranch className="mr-1 h-3 w-3" />
                      {site.default_branch}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Created</p>
                    <p>{new Date(site.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Asset Manager */}
              <div className="space-y-3 w-full">
                <h3 className="text-sm font-semibold">Assets</h3>
                <AssetManagerSidebar
                  siteId={siteId!}
                  pendingChanges={pendingChanges}
                  setPendingChanges={setPendingChanges}
                />
              </div>

              <Separator />

              {/* Members */}
              <div className="space-y-3 w-full">
                <div className="flex items-center justify-between gap-2 w-full">
                  <h3 className="text-sm font-semibold flex-shrink-0">Members</h3>
                  <div className="flex-shrink-0">
                    <InviteMemberDialog siteId={siteId!} onInviteCreated={loadInvitations} />
                  </div>
                </div>
                <div className="space-y-2">
                  {members.slice(0, 3).map((member) => {
                    const displayName = member.profile?.full_name || `User ${member.user_id.slice(0, 8)}`;
                    const initials = member.profile?.full_name
                      ? member.profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      : member.user_id.slice(0, 2).toUpperCase();

                    return (
                      <div key={member.user_id} className="flex items-center gap-2 w-full max-w-full">
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-accent text-primary-foreground">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-xs font-medium truncate">{displayName}</p>
                        </div>
                        <Badge variant={member.role === "owner" ? "default" : "secondary"} className="text-xs flex-shrink-0 whitespace-nowrap">
                          {member.role === "owner" && <Crown className="mr-1 h-2 w-2" />}
                          {member.role}
                        </Badge>
                      </div>
                    );
                  })}
                  {members.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{members.length - 3} more</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Activity Preview */}
              <div className="space-y-3 w-full">
                <h3 className="text-sm font-semibold">Recent Activity</h3>
                <div className="space-y-2">
                  {activities.slice(0, 3).map((activity) => (
                    <div key={activity.id} className="text-xs w-full">
                      <p className="font-medium truncate">{activity.action}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <p className="text-xs text-muted-foreground">No recent activity</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={80} minSize={50}>
          <div className="flex flex-col h-full">
            {/* Preview and Controls */}
            <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
              {/* Commit Controls - Prominent */}
              {pendingChanges.length > 0 && (
                <Card className="shadow-lg border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold text-sm">
                            {pendingChanges.length} Pending {pendingChanges.length === 1 ? 'Change' : 'Changes'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ready to commit to repository
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDiffDrawer(true)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPendingChanges([]);
                            toast.success('All changes cleared');
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear All
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const message = prompt("Enter commit message:");
                            if (!message?.trim()) return;

                            try {
                              const assetChanges = pendingChanges.map(change => ({
                                repo_path: change.repoPath,
                                content: change.content
                              }));

                              const { data, error } = await supabase.functions.invoke('commit-batch-changes', {
                                body: {
                                  site_id: siteId,
                                  commit_message: message,
                                  asset_changes: assetChanges
                                }
                              });

                              if (error) throw error;

                              toast.success('All changes committed!');
                              setPendingChanges([]);
                              loadActivities();
                            } catch (error: any) {
                              toast.error(error.message || 'Failed to commit');
                            }
                          }}
                        >
                          <GitCommit className="h-4 w-4 mr-2" />
                          Commit All
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Live Preview */}
              <Card className="flex-1 overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Live Preview</CardTitle>
                  <CardDescription className="text-xs">
                    Changes appear here in real-time before committing
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 h-[calc(100%-4rem)]">
                  <SitePreview
                    siteId={siteId!}
                    pendingChanges={pendingChanges}
                  />
                </CardContent>
              </Card>
            </main>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Diff Drawer */}
      <Sheet open={showDiffDrawer} onOpenChange={setShowDiffDrawer}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pending Changes</SheetTitle>
            <SheetDescription>
              Review all pending changes before committing
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <PendingBatchChanges
              siteId={siteId!}
              pendingChanges={pendingChanges}
              setPendingChanges={setPendingChanges}
              onRefresh={loadActivities}
              showActions={false}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Alert Dialog for leaving site */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {leaveAction === 'delete' ? 'Delete Site?' : 'Leave Site?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {leaveAction === 'delete'
                ? 'You are the last member of this site. Leaving will delete the site. This action cannot be undone.'
                : 'Are you sure you want to leave this site? You will need to be invited again to regain access.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeaveSite} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {leaveAction === 'delete' ? 'Delete Site' : 'Leave Site'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Manage;

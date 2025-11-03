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
import { ArrowLeft, ExternalLink, GitBranch, Users, FileText, Activity, Copy, Trash2, Check, User as UserIcon, Settings, UserCog, Crown, LogOut, Filter, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AssetManager from "@/components/AssetManager";
import InviteMemberDialog from "@/components/InviteMemberDialog";
import ActivityCard from "@/components/ActivityCard";
import type { Tables } from "@/integrations/supabase/types";

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Site Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Site Details</CardTitle>
            <CardDescription>General information about this site</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="min-w-0">
                <p className="text-sm font-medium mb-1">Repository</p>
                <button
                  onClick={() => window.open(getRepositoryUrl(site.repo_full_name), '_blank')}
                  className="text-sm text-muted-foreground flex items-center gap-2 hover:text-primary transition-colors cursor-pointer truncate w-full text-left"
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{site.repo_full_name}</span>
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
        <Tabs defaultValue="assets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="assets" className="text-xs sm:text-sm">
              <FileText className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Assets</span>
              <span className="sm:hidden">Files</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm">
              <Activity className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Activity</span>
              <span className="sm:hidden">Log</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs sm:text-sm">
              <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Members
            </TabsTrigger>
          </TabsList>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-6">
            <AssetManager siteId={siteId!} />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Activity Log</CardTitle>
                    <CardDescription>
                      Recent actions and events for this site
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Filters:</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <Select value={filterUserId} onValueChange={setFilterUserId}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.profile?.full_name || `User ${member.user_id.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterDateFrom ? format(filterDateFrom, "PPP") : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filterDateFrom}
                        onSelect={setFilterDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterDateTo ? format(filterDateTo, "PPP") : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filterDateTo}
                        onSelect={setFilterDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(filterUserId !== "all" || filterDateFrom || filterDateTo) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearFilters}
                      title="Clear filters"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No activity found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        repoFullName={site.repo_full_name}
                        userProfile={activity.user_profile}
                      />
                    ))}
                    {hasMoreActivities && (
                      <div className="flex justify-center pt-4">
                        <Button
                          variant="outline"
                          onClick={loadMoreActivities}
                        >
                          Load More
                        </Button>
                      </div>
                    )}
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
                      const isCurrentUser = member.user_id === currentUserId;
                      const canManage = currentUserRole === "owner" && !isCurrentUser && member.role !== "owner";
                      
                      return (
                        <div
                          key={`${member.site_id}-${member.user_id}`}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-border rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={member.profile?.avatar_url || undefined} alt={displayName} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm truncate">{displayName}</p>
                                {isCurrentUser && (
                                  <Badge variant="secondary" className="text-xs flex-shrink-0">You</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Added {new Date(member.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={member.role === "owner" ? "default" : "secondary"} className="flex-shrink-0">
                              {member.role === "owner" && <Crown className="mr-1 h-3 w-3" />}
                              {member.role}
                            </Badge>
                            {canManage && (
                              <>
                                {member.role === "manager" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePromoteToOwner(member.user_id, displayName)}
                                    title="Promote to owner"
                                    className="text-xs"
                                  >
                                    <UserCog className="h-3 w-3 sm:mr-1" />
                                    <span className="hidden sm:inline">Promote</span>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveMember(member.user_id, displayName)}
                                  title="Remove member"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
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
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {invitation.email || "Invitation link"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                          {invitation.invite_code && (
                            <p className="text-xs font-mono font-bold text-primary mt-1">
                              Code: {invitation.invite_code}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="flex-shrink-0">{invitation.role}</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopyInviteLink(invitation.token, invitation.id)}
                            title="Copy invite link"
                            className="flex-shrink-0"
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
                              className="flex-shrink-0"
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

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {leaveAction === 'delete' ? 'Delete Site?' : 'Leave Site?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {leaveAction === 'delete' 
                ? "You are the last member of this site. Leaving will permanently delete the site and all its data. This action cannot be undone."
                : "Are you sure you want to leave this site? You will lose access to manage it."}
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

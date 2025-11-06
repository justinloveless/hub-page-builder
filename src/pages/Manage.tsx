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
import { ArrowLeft, ExternalLink, GitBranch, Users, FileText, Activity, Copy, Trash2, Check, User as UserIcon, Settings, UserCog, Crown, LogOut, Filter, CalendarIcon, X, Package, GitCommit, Upload, Shield, Menu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import AssetManagerSidebar from "@/components/AssetManagerSidebar";
import PendingBatchChanges from "@/components/PendingBatchChanges";
import InviteMemberDialog from "@/components/InviteMemberDialog";
import ActivityCard from "@/components/ActivityCard";
import { SitePreview } from "@/components/SitePreview";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
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
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const ACTIVITIES_PER_PAGE = 10;

  // Activity filters
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterAssetPath, setFilterAssetPath] = useState<string>("all");

  // Activity audit dialog
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [allActivities, setAllActivities] = useState<ActivityWithProfile[]>([]);
  const [loadingAllActivities, setLoadingAllActivities] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);

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

  const loadActivities = async (page: number = 1, append: boolean = false, useFilters: boolean = true) => {
    if (!siteId) return;

    try {
      const from = (page - 1) * ACTIVITIES_PER_PAGE;
      const to = from + ACTIVITIES_PER_PAGE - 1;

      let query = supabase
        .from("activity_log")
        .select("*")
        .eq("site_id", siteId);

      // Apply filters only if useFilters is true
      if (useFilters) {
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
      }

      const { data: activitiesData, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Apply asset filter in memory if specified
      let filteredData = activitiesData || [];
      if (useFilters && filterAssetPath && filterAssetPath !== "all") {
        filteredData = filteredData.filter(activity => {
          const metadata = activity.metadata as any;
          if (!metadata) return false;
          const filePath = metadata.file_path || metadata.file_name || "";
          // Handle batch commits with files array
          if (metadata.files && Array.isArray(metadata.files)) {
            return metadata.files.some((f: string) => f === filterAssetPath);
          }
          return filePath === filterAssetPath;
        });
      }

      // Fetch profiles for activities
      const userIds = [...new Set(filteredData.map(a => a.user_id).filter(Boolean) || [])];
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

      const activitiesWithProfiles: ActivityWithProfile[] = filteredData.map(activity => ({
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

  const loadAllActivities = async (auditFilters: {
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    assetPath?: string;
  } = {}) => {
    if (!siteId) return;

    setLoadingAllActivities(true);
    try {
      let query = supabase
        .from("activity_log")
        .select("*")
        .eq("site_id", siteId);

      // Apply user filter
      if (auditFilters.userId && auditFilters.userId !== "all") {
        query = query.eq("user_id", auditFilters.userId);
      }

      // Apply date filters
      if (auditFilters.dateFrom) {
        query = query.gte("created_at", auditFilters.dateFrom.toISOString());
      }
      if (auditFilters.dateTo) {
        const endDate = new Date(auditFilters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt("created_at", endDate.toISOString());
      }

      const { data: activitiesData, error } = await query
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Apply asset filter in memory
      let filteredData = activitiesData || [];
      if (auditFilters.assetPath && auditFilters.assetPath !== "all") {
        filteredData = filteredData.filter(activity => {
          const metadata = activity.metadata as any;
          if (!metadata) return false;
          const filePath = metadata.file_path || metadata.file_name || "";
          // Handle batch commits with files array
          if (metadata.files && Array.isArray(metadata.files)) {
            return metadata.files.some((f: string) => f === auditFilters.assetPath);
          }
          return filePath === auditFilters.assetPath;
        });
      }

      // Fetch profiles for activities
      const userIds = [...new Set(filteredData.map(a => a.user_id).filter(Boolean) || [])];
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

      const activitiesWithProfiles: ActivityWithProfile[] = filteredData.map(activity => ({
        ...activity,
        user_profile: activity.user_id ? profilesMap[activity.user_id] : null
      }));

      setAllActivities(activitiesWithProfiles);
    } catch (error: any) {
      console.error("Failed to load all activities:", error);
      toast.error("Failed to load activity audit trail");
    } finally {
      setLoadingAllActivities(false);
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
    setFilterAssetPath("all");
  };

  const loadAvailableAssets = async () => {
    if (!siteId) return;

    try {
      // Get unique asset paths from activity logs
      const { data: activityData } = await supabase
        .from("activity_log")
        .select("metadata")
        .eq("site_id", siteId);

      const assetPaths = new Set<string>();

      if (activityData) {
        activityData.forEach((activity) => {
          const metadata = activity.metadata as any;
          if (metadata) {
            // Add file_path if present
            if (metadata.file_path) {
              assetPaths.add(metadata.file_path);
            }
            // Add file_name if present (as fallback)
            if (metadata.file_name && !metadata.file_path) {
              assetPaths.add(metadata.file_name);
            }
            // Handle batch commits with files array
            if (metadata.files && Array.isArray(metadata.files)) {
              metadata.files.forEach((file: string) => assetPaths.add(file));
            }
          }
        });
      }

      // Also fetch from site-assets.json config
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { data: assetsData } = await supabase.functions.invoke('fetch-site-assets', {
            body: { site_id: siteId },
          });

          if (assetsData?.found && assetsData.config?.assets) {
            assetsData.config.assets.forEach((asset: { path: string }) => {
              if (asset.path) {
                assetPaths.add(asset.path);
              }
            });
          }
        }
      } catch (error) {
        // Silently fail - we'll just use activity log data
        console.error("Failed to fetch site assets config:", error);
      }

      setAvailableAssets(Array.from(assetPaths).sort());
    } catch (error: any) {
      console.error("Failed to load available assets:", error);
    }
  };

  const handleOpenActivityDialog = () => {
    setShowActivityDialog(true);
    loadAvailableAssets();
    loadAllActivities({
      userId: filterUserId,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
      assetPath: filterAssetPath,
    });
  };

  const handleAuditFilterChange = (overrides?: {
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    assetPath?: string;
  }) => {
    loadAllActivities({
      userId: overrides?.userId ?? filterUserId,
      dateFrom: overrides?.dateFrom ?? filterDateFrom,
      dateTo: overrides?.dateTo ?? filterDateTo,
      assetPath: overrides?.assetPath ?? filterAssetPath,
    });
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
      <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Skeleton className="h-8 w-8 rounded mr-4" />
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 flex-1 overflow-auto">
          <Skeleton className="h-32 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center overflow-hidden">
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

  const sidebarContent = (
    <div className="h-full flex flex-col min-w-0 overflow-y-auto">
      <div className={`space-y-6 ${isMobile ? 'p-6' : 'p-4'}`}>
        {/* Site Details */}
        <div className="space-y-3 w-full">
          <h3 className={`font-semibold ${isMobile ? 'text-base' : 'text-sm'}`}>Site Details</h3>
          <div className={`space-y-2 ${isMobile ? 'text-sm' : 'text-xs'}`}>
            <div className="w-full">
              <p className="text-muted-foreground mb-1">Repository</p>
              <button
                onClick={() => window.open(getRepositoryUrl(site.repo_full_name), '_blank')}
                className="text-primary hover:underline flex items-center gap-1 w-full max-w-full"
              >
                <ExternalLink className={`flex-shrink-0 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'}`} />
                <span className="truncate min-w-0 flex-1">{site.repo_full_name}</span>
              </button>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Branch</p>
              <Badge variant="secondary" className={isMobile ? 'text-sm' : 'text-xs'}>
                <GitBranch className={`mr-1 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'}`} />
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
          <h3 className={`font-semibold ${isMobile ? 'text-base' : 'text-sm'}`}>Assets</h3>
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
            <h3 className={`font-semibold flex-shrink-0 ${isMobile ? 'text-base' : 'text-sm'}`}>Members</h3>
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
                  <Avatar className={`flex-shrink-0 ${isMobile ? 'h-8 w-8' : 'h-6 w-6'}`}>
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback className={`bg-gradient-to-br from-primary to-accent text-primary-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className={`font-medium truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>{displayName}</p>
                  </div>
                  <Badge variant={member.role === "owner" ? "default" : "secondary"} className={`flex-shrink-0 whitespace-nowrap ${isMobile ? 'text-sm' : 'text-xs'}`}>
                    {member.role === "owner" && <Crown className={`mr-1 ${isMobile ? 'h-3 w-3' : 'h-2 w-2'}`} />}
                    {member.role}
                  </Badge>
                </div>
              );
            })}
            {members.length > 3 && (
              <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>+{members.length - 3} more</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Activity Preview */}
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-semibold ${isMobile ? 'text-base' : 'text-sm'}`}>Recent Activity</h3>
            <Button
              variant="ghost"
              size="sm"
              className={`${isMobile ? 'h-8 px-3 text-sm' : 'h-6 px-2 text-xs'}`}
              onClick={handleOpenActivityDialog}
            >
              Show More
            </Button>
          </div>
          <div className="space-y-3">
            {activities.slice(0, 3).map((activity) => {
              const displayName = activity.user_profile?.full_name || `User ${activity.user_id?.slice(0, 8) || 'System'}`;
              const metadata = activity.metadata as any;

              return (
                <div key={activity.id} className={`w-full space-y-1 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                  <div className="flex items-start justify-between gap-2">
                    {/* Left side: Action and details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium truncate">{activity.action}</p>

                      {/* File Path */}
                      {metadata?.file_path && (
                        <div className={`flex items-center gap-1 text-muted-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>
                          <FileText className={`flex-shrink-0 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'}`} />
                          <span className="font-mono truncate">{metadata.file_path}</span>
                        </div>
                      )}

                      {/* File Name (if no file_path) */}
                      {!metadata?.file_path && metadata?.file_name && (
                        <div className={`flex items-center gap-1 text-muted-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>
                          <FileText className={`flex-shrink-0 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'}`} />
                          <span className="font-mono truncate">{metadata.file_name}</span>
                        </div>
                      )}

                      {/* Asset Count */}
                      {metadata?.asset_count && (
                        <div className={`flex items-center gap-1 text-muted-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>
                          <Upload className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />
                          {metadata.asset_count} {metadata.asset_count === 1 ? 'file' : 'files'}
                        </div>
                      )}

                      {/* Email for invitations */}
                      {metadata?.email && (
                        <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>
                          Sent to: <span className="font-medium">{metadata.email}</span>
                        </p>
                      )}

                      {/* Role changes */}
                      {metadata?.role && (
                        <div className={`flex items-center gap-1 text-muted-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>
                          <Shield className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />
                          Role: {metadata.role}
                        </div>
                      )}
                    </div>

                    {/* Right side: User and date */}
                    <div className={`flex-shrink-0 text-right space-y-0.5 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                      <p className="text-muted-foreground">
                        <span className="font-medium">{displayName}</span>
                      </p>
                      <p className="text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Links at the bottom */}
                  {(metadata?.pr_url && metadata?.pr_number) || metadata?.commit_sha ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* PR Link */}
                      {metadata?.pr_url && metadata?.pr_number && (
                        <a
                          href={metadata.pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-primary hover:underline ${isMobile ? 'text-sm' : 'text-xs'}`}
                        >
                          <GitBranch className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />
                          PR #{metadata.pr_number}
                        </a>
                      )}

                      {/* Commit Link */}
                      {metadata?.commit_sha && (
                        <a
                          href={`https://github.com/${site.repo_full_name}/commit/${metadata.commit_sha}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-primary hover:underline ${isMobile ? 'text-sm' : 'text-xs'}`}
                        >
                          <ExternalLink className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />
                          Commit {metadata.commit_sha.substring(0, 7)}
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {activities.length === 0 && (
              <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-xs'}`}>No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0 z-50">
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
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileSidebar(true)}
                  title="Menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
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

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Site Management</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="flex-1 overflow-auto">
              {sidebarContent}
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      )}

      {/* Desktop Layout with Resizable Panels */}
      {!isMobile ? (
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          {/* Sidebar */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35} className="overflow-hidden min-h-0">
            <div className="h-full flex flex-col min-w-0 border-r">
              {sidebarContent}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={80} minSize={50} className="overflow-hidden min-h-0">
            <div className="flex flex-col h-full min-h-0">
              {/* Preview and Controls */}
              <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">
                {/* Live Preview */}
                <Card className="flex-1 overflow-hidden flex flex-col">
                  <CardHeader className="pb-3 flex-shrink-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">Live Preview</CardTitle>
                        <CardDescription className="text-xs">
                          {pendingChanges.length > 0
                            ? `${pendingChanges.length} pending ${pendingChanges.length === 1 ? 'change' : 'changes'} ready to commit`
                            : 'Changes appear here in real-time before committing'}
                        </CardDescription>
                      </div>
                      {pendingChanges.length > 0 && (
                        <div className="flex items-center gap-2 flex-shrink-0">
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
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-hidden">
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
      ) : (
        // Mobile view - full-width preview
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <main className="flex-1 flex flex-col p-2 overflow-hidden min-h-0">
            <Card className="flex-1 overflow-hidden flex flex-col">
              {pendingChanges.length > 0 ? (
                <CardHeader className="py-2 px-3 flex-shrink-0 border-b">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        {pendingChanges.length} change{pendingChanges.length !== 1 && 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setShowDiffDrawer(true)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => {
                          setPendingChanges([]);
                          toast.success('All changes cleared');
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2"
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
                        <GitCommit className="h-3.5 w-3.5 mr-1.5" />
                        Commit
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              ) : null}
              <CardContent className="p-0 flex-1 overflow-hidden">
                <SitePreview
                  siteId={siteId!}
                  pendingChanges={pendingChanges}
                />
              </CardContent>
            </Card>
          </main>
        </div>
      )}

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

      {/* Activity Audit Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Activity Audit Trail</DialogTitle>
            <DialogDescription>
              Complete history of all activities for this site
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="space-y-4 border-b pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by User</label>
                <Select value={filterUserId} onValueChange={(value) => {
                  setFilterUserId(value);
                  handleAuditFilterChange({ userId: value });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {members.map((member) => {
                      const displayName = member.profile?.full_name || `User ${member.user_id.slice(0, 8)}`;
                      return (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {displayName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Asset Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Asset</label>
                <Select value={filterAssetPath} onValueChange={(value) => {
                  setFilterAssetPath(value);
                  handleAuditFilterChange({ assetPath: value });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All assets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assets</SelectItem>
                    {availableAssets.length === 0 ? (
                      <SelectItem value="loading" disabled>Loading assets...</SelectItem>
                    ) : (
                      availableAssets.map((assetPath) => (
                        <SelectItem key={assetPath} value={assetPath}>
                          <span className="font-mono text-xs">{assetPath}</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateFrom ? format(filterDateFrom, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filterDateFrom}
                      onSelect={(date) => {
                        setFilterDateFrom(date);
                        handleAuditFilterChange({ dateFrom: date });
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateTo ? format(filterDateTo, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filterDateTo}
                      onSelect={(date) => {
                        setFilterDateTo(date);
                        handleAuditFilterChange({ dateTo: date });
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearFilters();
                  handleAuditFilterChange({
                    userId: "all",
                    dateFrom: undefined,
                    dateTo: undefined,
                    assetPath: "all",
                  });
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Activity List */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {loadingAllActivities ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading activities...</div>
              </div>
            ) : allActivities.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">No activities found</div>
              </div>
            ) : (
              allActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  repoFullName={site.repo_full_name}
                  userProfile={activity.user_profile}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Manage;

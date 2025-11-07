import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Plus, LogOut, Settings, User as UserIcon } from "lucide-react";
import SiteCard from "@/components/SiteCard";
import AddSiteDialog from "@/components/AddSiteDialog";
import JoinWithCodeDialog from "@/components/JoinWithCodeDialog";
import SubmitTemplateDialog from "@/components/SubmitTemplateDialog";
import type { Tables } from "@/integrations/supabase/types";
import logo from "@/assets/staticsnack-logo.png";

type Site = Tables<"sites">;

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user && event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkAdminRole(session.user.id);
        loadSites();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });

      if (!error && data) {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error("Error checking admin role:", error);
    }
  };

  const loadSites = async () => {
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (error: any) {
      toast.error("Failed to load sites");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={logo} alt="StaticSnack" className="w-10 h-10 rounded-lg flex-shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold truncate">StaticSnack</h1>
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
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/settings")}
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Your Sites</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage all your static sites in one place
            </p>
          </div>
          <div className="flex gap-2 sm:flex-shrink-0">
            <SubmitTemplateDialog />
            <JoinWithCodeDialog />
            <AddSiteDialog onSiteAdded={loadSites} />
          </div>
        </div>

        {sites.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
              <Plus className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">No sites yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by adding your first static site. Connect your GitHub repository
              and start managing content with ease. Or join an existing site with an invite code.
            </p>
            <div className="flex gap-2 justify-center">
              <SubmitTemplateDialog />
              <JoinWithCodeDialog />
              <AddSiteDialog onSiteAdded={loadSites} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

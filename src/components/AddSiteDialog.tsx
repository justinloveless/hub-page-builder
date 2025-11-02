import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Github } from "lucide-react";

interface AddSiteDialogProps {
  onSiteAdded: () => void;
}

const AddSiteDialog = ({ onSiteAdded }: AddSiteDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    repoFullName: "",
    defaultBranch: "main",
    githubInstallationId: "",
  });

  useEffect(() => {
    // Listen for GitHub OAuth callback
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        const { installation_id, repositories } = event.data.data;
        
        // If we have repositories, use the first one to pre-fill
        if (repositories && repositories.length > 0) {
          const repo = repositories[0];
          setFormData({
            name: repo.name,
            repoFullName: repo.full_name,
            defaultBranch: repo.default_branch || "main",
            githubInstallationId: installation_id.toString(),
          });
        } else {
          setFormData({
            ...formData,
            githubInstallationId: installation_id.toString(),
          });
        }
        
        toast.success("Connected to GitHub successfully!");
        setConnectingGithub(false);
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        toast.error(event.data.error || "Failed to connect to GitHub");
        setConnectingGithub(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [formData]);

  const handleConnectGithub = async () => {
    setConnectingGithub(true);
    
    try {
      // Fetch GitHub app config
      const { data: config, error } = await supabase
        .from('github_app_config')
        .select('client_id, slug')
        .maybeSingle();

      if (error) {
        throw new Error("Failed to load GitHub App configuration");
      }

      if (!config) {
        throw new Error("GitHub App not configured. Please contact your administrator.");
      }

      // Build OAuth URL
      const redirectUri = `${window.location.origin}/github/callback`;
      const state = crypto.randomUUID();
      sessionStorage.setItem('github_oauth_state', state);
      
      const oauthUrl = `https://github.com/apps/${config.slug}/installations/new?state=${state}`;
      
      // Open in popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        oauthUrl,
        'GitHub OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error: any) {
      console.error("Error connecting to GitHub:", error);
      toast.error(error.message || "Failed to connect to GitHub");
      setConnectingGithub(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Validate GitHub installation ID
      const installationId = parseInt(formData.githubInstallationId);
      if (isNaN(installationId) || installationId <= 0) {
        throw new Error("Please enter a valid GitHub Installation ID");
      }

      // Call the edge function to create the site
      const { data, error } = await supabase.functions.invoke('create-site', {
        body: {
          name: formData.name,
          repo_full_name: formData.repoFullName,
          default_branch: formData.defaultBranch,
          github_installation_id: installationId,
        },
      });

      if (error) throw error;
      if (!data?.site) throw new Error("Failed to create site");

      toast.success("Site added successfully!");
      setOpen(false);
      setFormData({
        name: "",
        repoFullName: "",
        defaultBranch: "main",
        githubInstallationId: "",
      });
      onSiteAdded();
    } catch (error: any) {
      console.error("Error adding site:", error);
      toast.error(error.message || "Failed to add site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="mr-2 h-5 w-5" />
          Add Site
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Add New Site
            </DialogTitle>
            <DialogDescription>
              Connect a GitHub repository to start managing your static site
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-center pb-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleConnectGithub}
                disabled={connectingGithub}
                className="w-full"
              >
                {connectingGithub ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Github className="mr-2 h-4 w-4" />
                    Connect with GitHub
                  </>
                )}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or enter manually
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Site Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Site"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="repo">Repository</Label>
              <Input
                id="repo"
                placeholder="username/repository"
                value={formData.repoFullName}
                onChange={(e) => setFormData({ ...formData, repoFullName: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Format: owner/repo-name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Default Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={formData.defaultBranch}
                onChange={(e) => setFormData({ ...formData, defaultBranch: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="installation">GitHub Installation ID</Label>
              <Input
                id="installation"
                type="number"
                placeholder="12345678"
                value={formData.githubInstallationId}
                onChange={(e) => setFormData({ ...formData, githubInstallationId: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Auto-filled when you connect with GitHub
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Site
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSiteDialog;

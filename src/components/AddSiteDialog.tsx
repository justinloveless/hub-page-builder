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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Github, BookOpen, Settings, CheckCircle2 } from "lucide-react";

interface AddSiteDialogProps {
  onSiteAdded: () => void;
}

interface Repository {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
}

interface Installation {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url: string;
  };
  repository_count: number;
  repositories: Repository[];
}

interface Site {
  id: string;
  name: string;
  repo_full_name: string;
  default_branch: string;
  github_installation_id: number;
}

const AddSiteDialog = ({ onSiteAdded }: AddSiteDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [activeTab, setActiveTab] = useState("github");
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [existingSites, setExistingSites] = useState<Site[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    repoFullName: "",
    defaultBranch: "main",
    githubInstallationId: "",
  });

  // Load existing sites when dialog opens
  useEffect(() => {
    if (open) {
      loadExistingSites();
    }
  }, [open]);

  const loadExistingSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingSites(data || []);
    } catch (error: any) {
      console.error('Error loading sites:', error);
    }
  };

  const isRepositoryAdded = (repoFullName: string): boolean => {
    return existingSites.some(site => site.repo_full_name === repoFullName);
  };

  useEffect(() => {
    // Listen for GitHub OAuth callback
    const handleMessage = (event: MessageEvent) => {
      // Validate origin for security
      if (event.origin !== window.location.origin) {
        console.warn('Received message from unexpected origin:', event.origin);
        return;
      }

      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        const { installation_id, repositories } = event.data.data;
        
        console.log('GitHub connection successful:', { installation_id, repoCount: repositories?.length });
        
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
          setFormData(prev => ({
            ...prev,
            githubInstallationId: installation_id.toString(),
          }));
        }
        
        toast.success("Connected to GitHub successfully!");
        setConnectingGithub(false);
        setPopupWindow(null);
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        console.error('GitHub OAuth error:', event.data.error);
        toast.error(event.data.error || "Failed to connect to GitHub");
        setConnectingGithub(false);
        setPopupWindow(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Monitor popup window and handle timeout
  useEffect(() => {
    if (!popupWindow || !connectingGithub) return;

    const checkInterval = setInterval(() => {
      if (popupWindow.closed) {
        clearInterval(checkInterval);
        if (connectingGithub) {
          console.log('Popup was closed');
          toast.info("GitHub connection window was closed. Please try again.");
          setConnectingGithub(false);
          setPopupWindow(null);
        }
      }
    }, 500);

    // Timeout after 3 minutes
    const timeout = setTimeout(() => {
      if (connectingGithub && popupWindow && !popupWindow.closed) {
        popupWindow.close();
        toast.error("Connection timed out. Please try again.");
        setConnectingGithub(false);
        setPopupWindow(null);
      }
      clearInterval(checkInterval);
    }, 180000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, [popupWindow, connectingGithub]);

  const handleFetchInstallations = async () => {
    setConnectingGithub(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Call edge function to list installations
      const { data, error } = await supabase.functions.invoke('list-github-installations');

      if (error) throw error;
      if (!data?.installations || data.installations.length === 0) {
        throw new Error("No GitHub App installations found. Please install the app first.");
      }

      console.log('Found installations:', data.installations);
      setInstallations(data.installations);
      toast.success(`Found ${data.installations.length} installation(s) with repositories`);
    } catch (error: any) {
      console.error("Error fetching installations:", error);
      toast.error(error.message || "Failed to fetch GitHub installations");
    } finally {
      setConnectingGithub(false);
    }
  };

  const handleSelectRepository = async (repo: Repository, installationId: number) => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Call the edge function to create the site
      const { data, error } = await supabase.functions.invoke('create-site', {
        body: {
          name: repo.name,
          repo_full_name: repo.full_name,
          default_branch: repo.default_branch || "main",
          github_installation_id: installationId,
        },
      });

      if (error) throw error;
      if (!data?.site) throw new Error("Failed to create site");

      toast.success(`Site "${repo.name}" added successfully!`);
      setOpen(false);
      
      // Reset form and installations
      setFormData({
        name: "",
        repoFullName: "",
        defaultBranch: "main",
        githubInstallationId: "",
      });
      setInstallations([]);
      
      onSiteAdded();
    } catch (error: any) {
      console.error("Error adding site:", error);
      toast.error(error.message || "Failed to add site");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGithub = async () => {
    setConnectingGithub(true);
    
    try {
      // Fetch GitHub app config
      const { data: config, error } = await supabase
        .from('github_app_public_config')
        .select('client_id, slug')
        .maybeSingle();

      if (error) {
        throw new Error("Failed to load GitHub App configuration");
      }

      if (!config) {
        throw new Error("GitHub App not configured. Please contact your administrator.");
      }

      console.log('Opening GitHub connection with slug:', config.slug);

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
      
      const popup = window.open(
        oauthUrl,
        'GitHub OAuth',
        `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
      );

      if (!popup) {
        throw new Error("Popup was blocked. Please allow popups for this site and try again.");
      }

      setPopupWindow(popup);
      
      // Focus the popup
      popup.focus();
      
      console.log('GitHub OAuth popup opened');
    } catch (error: any) {
      console.error("Error connecting to GitHub:", error);
      toast.error(error.message || "Failed to connect to GitHub");
      setConnectingGithub(false);
      setPopupWindow(null);
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Add New Site
          </DialogTitle>
          <DialogDescription>
            Connect a GitHub repository to start managing your static site
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full flex-shrink-0 grid-cols-2">
            <TabsTrigger value="github">
              <Github className="mr-2 h-4 w-4" />
              From GitHub
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Settings className="mr-2 h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-2">
            <TabsContent value="github" className="mt-0 h-full">
              <div className="space-y-4 pb-4 px-1">
                <div className="space-y-2">
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
                        Waiting for GitHub...
                      </>
                    ) : (
                      <>
                        <Github className="mr-2 h-4 w-4" />
                        Install GitHub App
                      </>
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFetchInstallations}
                    disabled={connectingGithub}
                    className="w-full"
                  >
                    {connectingGithub ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <BookOpen className="mr-2 h-4 w-4" />
                        I've Already Installed - Fetch Repositories
                      </>
                    )}
                  </Button>
                  
                  {connectingGithub && (
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Complete the GitHub installation in the popup window
                    </p>
                  )}
                </div>

                {installations.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Available Repositories</h3>
                      <Badge variant="secondary">
                        {installations.reduce((total, inst) => total + inst.repository_count, 0)} repos
                      </Badge>
                    </div>

                    {installations.map((installation) => (
                      <div key={installation.id} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <img
                            src={installation.account.avatar_url}
                            alt={installation.account.login}
                            className="w-5 h-5 rounded-full"
                          />
                          <span>{installation.account.login}</span>
                          <Badge variant="outline" className="text-xs">
                            {installation.account.type}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          {installation.repositories.map((repo) => {
                            const isAdded = isRepositoryAdded(repo.full_name);
                            
                            return (
                              <Card key={repo.full_name} className="hover:bg-accent/50 transition-colors">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <Github className="h-4 w-4" />
                                    {repo.name}
                                    {repo.private && (
                                      <Badge variant="secondary" className="text-xs">Private</Badge>
                                    )}
                                  </CardTitle>
                                  <CardDescription className="text-xs">
                                    {repo.full_name}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="pb-3">
                                  <p className="text-xs text-muted-foreground">
                                    Default branch: <span className="font-mono">{repo.default_branch}</span>
                                  </p>
                                </CardContent>
                                <CardFooter className="flex-col gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSelectRepository(repo, installation.id)}
                                    className="w-full"
                                    disabled={isAdded || loading}
                                  >
                                    {loading ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Adding...
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add This Repository
                                      </>
                                    )}
                                  </Button>
                                  {isAdded && (
                                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 w-full justify-center">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Repository already added
                                    </p>
                                  )}
                                </CardFooter>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {installations.length === 0 && !connectingGithub && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Github className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No repositories found yet.</p>
                    <p className="text-xs mt-2">Install the GitHub App or fetch your installations to see available repositories.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-0 h-full">
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 pb-4 px-1">
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
                      Auto-filled when you select a repository from GitHub tab
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
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
                  </div>
                </div>
              </form>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddSiteDialog;

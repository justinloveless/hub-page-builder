import { useState, useEffect, useCallback } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Plus, Github, BookOpen, Settings, CheckCircle2, PackagePlus, Search, AlertCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useGithubInstallations, GithubInstallation } from "@/contexts/GithubInstallationContext";

interface AddSiteDialogProps {
  onSiteAdded: () => void;
}

interface Repository {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
}

type Installation = GithubInstallation;

interface Site {
  id: string;
  name: string;
  repo_full_name: string;
  default_branch: string;
  github_installation_id: number;
}

type Template = Tables<"templates">;

interface TemplateWithProfile extends Template {
  profiles?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const AddSiteDialog = ({ onSiteAdded }: AddSiteDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [activeTab, setActiveTab] = useState("github");
  const [existingSites, setExistingSites] = useState<Site[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    repoFullName: "",
    defaultBranch: "main",
    githubInstallationId: "",
  });

  // Template state
  const [templates, setTemplates] = useState<TemplateWithProfile[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    siteName: "",
    repoName: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [githubSearchQuery, setGithubSearchQuery] = useState("");
  const [dialogInstallationError, setDialogInstallationError] = useState<string | null>(null);

  const {
    installations,
    isLoading: installationsLoading,
    error: installationsError,
    hasInstallations,
    refreshInstallations,
  } = useGithubInstallations();

  // Load existing sites and templates when dialog opens
  useEffect(() => {
    if (open) {
      loadExistingSites();
      if (activeTab === "template") {
        loadTemplates();
      }
    }
  }, [open, activeTab]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-templates');

      if (error) throw error;
      setTemplates(data?.templates || []);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast.error("Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

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

  const handleFetchInstallations = useCallback(async () => {
    setConnectingGithub(true);
    try {
      const fetched = await refreshInstallations();
      setDialogInstallationError(null);

      if (fetched.length === 0) {
        toast.error("No GitHub App installations found. Please install the app first.");
      } else {
        toast.success(`Found ${fetched.length} installation(s) with repositories`);
      }
    } catch (error: any) {
      console.error("Error fetching installations:", error);
      const message = error?.message || "Failed to fetch GitHub installations";
      setDialogInstallationError(message);
      toast.error(message);
    } finally {
      setConnectingGithub(false);
    }
  }, [refreshInstallations]);

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

        toast.success("Connected to GitHub successfully!");
        setConnectingGithub(false);
        setPopupWindow(null);
        setDialogInstallationError(null);

        // Automatically refresh installations shortly after the callback completes
        setTimeout(() => {
          refreshInstallations()
            .then(() => {
              setDialogInstallationError(null);
            })
            .catch((error: any) => {
              console.error("Error refreshing installations after GitHub callback:", error);
              setDialogInstallationError(error?.message || "Failed to refresh GitHub installations.");
            });
        }, 500);
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        console.error('GitHub OAuth error:', event.data.error);
        toast.error(event.data.error || "Failed to connect to GitHub");
        setConnectingGithub(false);
        setPopupWindow(null);
        setDialogInstallationError(event.data.error || "Failed to connect to GitHub");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshInstallations]);

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

  useEffect(() => {
    if (!open) {
      setDialogInstallationError(null);
    }
  }, [open]);

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

      // Reset form state
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
      localStorage.setItem('github_oauth_state', state);

      const oauthUrl = `https://github.com/apps/${config.slug}/installations/new?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      // Open in popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        oauthUrl,
        'GitHub OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
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
      setInstallationCheckError(error.message || "Failed to connect to GitHub");
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

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Validate inputs
      if (!templateFormData.siteName.trim() || !templateFormData.repoName.trim()) {
        throw new Error("Please fill in all required fields");
      }

      // Validate repo name
      if (!templateFormData.repoName.match(/^[a-zA-Z0-9_.-]+$/)) {
        throw new Error("Invalid repository name. Use only letters, numbers, hyphens, underscores, and dots.");
      }

      // Call the edge function to create site from template
      const { data, error } = await supabase.functions.invoke('create-site-from-template', {
        body: {
          template_id: selectedTemplate.id,
          new_repo_name: templateFormData.repoName,
          site_name: templateFormData.siteName,
        },
      });

      if (error) throw error;
      if (!data?.site) throw new Error("Failed to create site from template");

      toast.success(`Site "${templateFormData.siteName}" created successfully!`);
      setOpen(false);

      // Reset form
      setSelectedTemplate(null);
      setTemplateFormData({
        siteName: "",
        repoName: "",
      });

      onSiteAdded();
    } catch (error: any) {
      console.error("Error creating site from template:", error);
      toast.error(error.message || "Failed to create site from template");
    } finally {
      setLoading(false);
    }
  };

  // Filter templates by search and tags
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag = !selectedTagFilter || template.tags.includes(selectedTagFilter);

    return matchesSearch && matchesTag;
  });

  // Get unique tags from all templates
  const allTags = Array.from(new Set(templates.flatMap(t => t.tags))).sort();

  // Filter GitHub repositories by search query
  const filteredInstallations = installations.map(installation => ({
    ...installation,
    repositories: installation.repositories.filter(repo =>
      !githubSearchQuery ||
      repo.name.toLowerCase().includes(githubSearchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(githubSearchQuery.toLowerCase())
    )
  })).filter(installation => installation.repositories.length > 0);

  const installationErrorMessage = dialogInstallationError || installationsError;
  const isFetchingInstallations = connectingGithub || installationsLoading;

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

        {installationErrorMessage && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to check GitHub App installations</AlertTitle>
            <AlertDescription>{installationErrorMessage}</AlertDescription>
          </Alert>
        )}

        {!installationErrorMessage && !installationsLoading && !hasInstallations && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No GitHub App installation found</AlertTitle>
            <AlertDescription>
              Install the GitHub App before adding a site or creating one from a template. Use the GitHub tab below to install or refresh installations.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full flex-shrink-0 grid-cols-3">
            <TabsTrigger value="template">
              <PackagePlus className="mr-2 h-4 w-4" />
              From Template
            </TabsTrigger>
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
            <TabsContent value="template" className="mt-0 h-full">
              <div className="space-y-4 pb-4 px-1">
                {/* Search and filters */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={selectedTagFilter === null ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setSelectedTagFilter(null)}
                      >
                        All
                      </Badge>
                      {allTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTagFilter === tag ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSelectedTagFilter(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {loadingTemplates ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading templates...</p>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <PackagePlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No templates found.</p>
                    <p className="text-xs mt-2">Try adjusting your search or filters.</p>
                  </div>
                ) : selectedTemplate ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{selectedTemplate.name}</CardTitle>
                            <CardDescription className="text-xs">{selectedTemplate.description}</CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTemplate(null)}
                          >
                            Back
                          </Button>
                        </div>
                      </CardHeader>
                      {selectedTemplate.preview_image_url && (
                        <CardContent className="pb-3">
                          <img
                            src={selectedTemplate.preview_image_url}
                            alt={selectedTemplate.name}
                            className="w-full rounded-md border"
                          />
                        </CardContent>
                      )}
                      <CardFooter className="flex-col gap-2 items-start">
                        <div className="flex flex-wrap gap-1">
                          {selectedTemplate.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Template: <span className="font-mono">{selectedTemplate.repo_full_name}</span>
                        </p>
                      </CardFooter>
                    </Card>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="siteName">Site Name *</Label>
                        <Input
                          id="siteName"
                          placeholder="My Awesome Site"
                          value={templateFormData.siteName}
                          onChange={(e) => setTemplateFormData({ ...templateFormData, siteName: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="repoName">New Repository Name *</Label>
                        <Input
                          id="repoName"
                          placeholder="my-awesome-site"
                          value={templateFormData.repoName}
                          onChange={(e) => setTemplateFormData({ ...templateFormData, repoName: e.target.value })}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          A new repository will be created in your GitHub account
                        </p>
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleCreateFromTemplate}
                        disabled={loading || !templateFormData.siteName || !templateFormData.repoName}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Site...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Site from Template
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className="hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedTemplate(template)}
                      >
                        {template.preview_image_url && (
                          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                            <img
                              src={template.preview_image_url}
                              alt={template.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          <CardDescription className="text-xs line-clamp-2">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="flex-col gap-2 items-start pt-0">
                          <div className="flex flex-wrap gap-1">
                            {template.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {template.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{template.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {template.profiles?.full_name || 'Anonymous'}
                          </p>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="github" className="mt-0 h-full">
              <div className="space-y-4 pb-4 px-1 overflow-x-hidden">
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
                    disabled={isFetchingInstallations}
                    className="w-full"
                  >
                    {isFetchingInstallations ? (
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
                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search repositories..."
                        value={githubSearchQuery}
                        onChange={(e) => setGithubSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Available Repositories</h3>
                      <Badge variant="secondary">
                        {filteredInstallations.reduce((total, inst) => total + inst.repositories.length, 0)} repos
                      </Badge>
                    </div>

                    {filteredInstallations.length > 0 ? (
                      filteredInstallations.map((installation) => (
                        <div key={installation.id} className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium min-w-0 overflow-hidden">
                            <img
                              src={installation.account.avatar_url}
                              alt={installation.account.login}
                              className="w-5 h-5 rounded-full flex-shrink-0"
                            />
                            <span className="truncate min-w-0">{installation.account.login}</span>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {installation.account.type}
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            {installation.repositories.map((repo) => {
                              const isAdded = isRepositoryAdded(repo.full_name);

                              return (
                                <Card key={repo.full_name} className="hover:bg-accent/50 transition-colors w-full min-w-0">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-sm flex items-center gap-2 break-words min-w-0">
                                      <Github className="h-4 w-4 flex-shrink-0" />
                                      <span className="break-words min-w-0 flex-1">{repo.name}</span>
                                      {repo.private && (
                                        <Badge variant="secondary" className="text-xs flex-shrink-0">Private</Badge>
                                      )}
                                    </CardTitle>
                                    <CardDescription className="text-xs break-words overflow-hidden">
                                      {repo.full_name}
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent className="pb-3">
                                    <p className="text-xs text-muted-foreground break-words overflow-hidden">
                                      Default branch: <span className="font-mono break-all">{repo.default_branch}</span>
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
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No repositories match your search.</p>
                        <p className="text-xs mt-2">Try adjusting your search query.</p>
                      </div>
                    )}
                  </div>
                )}

                {installations.length === 0 && !connectingGithub && !installationsLoading && (
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

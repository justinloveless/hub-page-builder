import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save, FileDown, AlertCircle } from "lucide-react";
import { GrapesEditor } from "@/components/GrapesEditor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatureFlags } from "@/contexts/FeatureFlagContext";
import type { Tables } from "@/integrations/supabase/types";

type Site = Tables<"sites">;

const SiteEditor = () => {
  const navigate = useNavigate();
  const { siteId, filePath } = useParams<{ siteId: string; filePath?: string }>();
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<Site | null>(null);
  const [initialHtml, setInitialHtml] = useState("");
  const [initialCss, setInitialCss] = useState("");
  const [currentHtml, setCurrentHtml] = useState("");
  const [currentCss, setCurrentCss] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingPath, setEditingPath] = useState<string>("index.html");
  const [externalStyles, setExternalStyles] = useState<string[]>([]);
  const [externalScripts, setExternalScripts] = useState<string[]>([]);
  const [siteData, setSiteData] = useState<any>(null);
  const [githubPagesBaseUrl, setGithubPagesBaseUrl] = useState<string>('');

  const grapesjsEnabled = isEnabled("use_grapesjs");

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      if (siteId) {
        const siteData = await loadSite();
        if (siteData) {
          await loadFileContent(siteData);
        }
      }
      setLoading(false);
    };

    checkAuthAndLoad();
  }, [siteId, filePath, navigate]);

  const loadSite = async () => {
    if (!siteId) return null;

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
        return null;
      }
      setSite(data);
      return data;
    } catch (error: any) {
      toast.error("Failed to load site");
      console.error(error);
      navigate("/dashboard");
      return null;
    }
  };

  const loadFileContent = async (siteData: Site) => {
    if (!siteId) return;

    try {
      // Use the filePath param or default to index.html
      const targetPath = filePath || "index.html";
      setEditingPath(targetPath);

      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: {
          site_id: siteId,
          asset_path: targetPath
        }
      });

      if (error) throw error;

      if (data?.content) {
        // Parse HTML and extract CSS if present
        const content = data.content;

        // Extract all inline CSS from style tags
        const styleMatches = content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        let inlineCSS = '';
        for (const match of styleMatches) {
          inlineCSS += match[1] + '\n';
        }

        // Extract external CSS file references from link tags
        const linkMatches = content.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi);
        const cssFiles: string[] = [];
        const externalCssUrls: string[] = [];
        for (const match of linkMatches) {
          const href = match[1];
          // Separate site CSS files from external CDN URLs
          if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
            externalCssUrls.push(href);
          } else {
            cssFiles.push(href);
          }
        }

        // Extract all external scripts from script tags
        const externalScriptUrls: string[] = [];
        const scriptMatches = content.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi);

        // Get the site's GitHub Pages URL to resolve relative paths
        const githubPagesUrl = siteData.repo_full_name
          ? `https://${siteData.repo_full_name.split('/')[0]}.github.io/${siteData.repo_full_name.split('/')[1]}/`
          : '';

        // Store for use by GrapesEditor
        setGithubPagesBaseUrl(githubPagesUrl);

        for (const match of scriptMatches) {
          let src = match[1];
          // Convert relative paths to absolute URLs using GitHub Pages URL
          if (githubPagesUrl && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//')) {
            // Handle both absolute paths (/path) and relative paths (path)
            if (src.startsWith('/')) {
              src = `${githubPagesUrl.replace(/\/$/, '')}${src}`;
            } else {
              src = `${githubPagesUrl}${src}`;
            }
          }
          externalScriptUrls.push(src);
        }

        // Fetch site-assets.json if it exists (for templates with dynamic content)
        let siteAssetsData = null;
        try {
          const { data: siteAssetsContent } = await supabase.functions.invoke('fetch-asset-content', {
            body: {
              site_id: siteId,
              asset_path: 'site-assets.json'
            }
          });
          if (siteAssetsContent?.content) {
            siteAssetsData = JSON.parse(siteAssetsContent.content);
            console.log('site-assets.json loaded:', siteAssetsData);
          }
        } catch (error) {
          // site-assets.json doesn't exist, that's okay
          console.log('No site-assets.json found, skipping');
        }

        // Store external URLs and site data for GrapesJS canvas
        setExternalStyles(externalCssUrls);
        setExternalScripts(externalScriptUrls);
        setSiteData(siteAssetsData);

        // Fetch external CSS files
        let externalCSS = '';
        for (const cssFile of cssFiles) {
          try {
            const { data: cssData, error: cssError } = await supabase.functions.invoke('fetch-asset-content', {
              body: {
                site_id: siteId,
                asset_path: cssFile
              }
            });
            if (!cssError && cssData?.content) {
              externalCSS += cssData.content + '\n';
            }
          } catch (cssError) {
            console.warn(`Failed to load external CSS: ${cssFile}`, cssError);
          }
        }

        // Combine all CSS
        const combinedCSS = externalCSS + inlineCSS;

        // Remove style tags and link tags from HTML
        let cleanHtml = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        cleanHtml = cleanHtml.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');

        // Extract body content if it's a full HTML document
        const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const html = bodyMatch ? bodyMatch[1] : cleanHtml;

        setInitialHtml(html.trim());
        setInitialCss(combinedCSS.trim());
        setCurrentHtml(html.trim());
        setCurrentCss(combinedCSS.trim());
      } else {
        // Start with empty document
        setInitialHtml('<div class="container"><h1>Welcome to Your Site</h1><p>Start editing!</p></div>');
        setInitialCss('body { margin: 0; padding: 20px; font-family: sans-serif; }');
        setCurrentHtml('<div class="container"><h1>Welcome to Your Site</h1><p>Start editing!</p></div>');
        setCurrentCss('body { margin: 0; padding: 20px; font-family: sans-serif; }');
      }
    } catch (error: any) {
      console.error("Failed to load file content:", error);
      toast.error("Failed to load file content");
      // Start with default content on error
      setInitialHtml('<div class="container"><h1>Welcome to Your Site</h1><p>Start editing!</p></div>');
      setInitialCss('body { margin: 0; padding: 20px; font-family: sans-serif; }');
    }
  };

  const handleUpdate = (html: string, css: string) => {
    setCurrentHtml(html);
    setCurrentCss(css);
    setHasChanges(html !== initialHtml || css !== initialCss);
  };

  const handleSave = async (html: string, css: string) => {
    if (!siteId || !site) return;

    setSaving(true);
    try {
      // Construct complete HTML document
      const completeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${site.name}</title>
    <style>
${css}
    </style>
</head>
<body>
${html}
</body>
</html>`;

      // Upload the file
      const { data, error } = await supabase.functions.invoke('upload-site-asset', {
        body: {
          site_id: siteId,
          file_path: editingPath,
          content: completeHtml,
          commit_message: `Update ${editingPath} via visual editor`,
        }
      });

      if (error) throw error;

      toast.success("Changes saved successfully!");
      setInitialHtml(html);
      setInitialCss(css);
      setHasChanges(false);

      // Optionally navigate back to manage page
      // navigate(`/manage/${siteId}`);
    } catch (error: any) {
      console.error("Failed to save:", error);
      toast.error(error.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleExportHtml = () => {
    const completeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${site?.name || 'My Site'}</title>
    <style>
${currentCss}
    </style>
</head>
<body>
${currentHtml}
</body>
</html>`;

    const blob = new Blob([completeHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = editingPath;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("HTML file downloaded!");
  };

  if (loading || flagsLoading) {
    return (
      <div className="h-screen w-full flex flex-col bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Skeleton className="h-8 w-8 rounded mr-4" />
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading editor...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
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

  if (!grapesjsEnabled) {
    return (
      <div className="h-screen w-full flex flex-col bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/manage/${siteId}`)}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold truncate">Visual Editor</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {site.name} - {editingPath}
                </p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Feature Not Available</AlertTitle>
            <AlertDescription>
              The GrapesJS visual editor is currently disabled. Please contact an administrator to enable the "use_grapesjs" feature flag.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/manage/${siteId}`)}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold truncate">Visual Editor</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {site.name} - {editingPath}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportHtml}
                disabled={saving}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Export HTML
              </Button>
              <Button
                size="sm"
                onClick={() => handleSave(currentHtml, currentCss)}
                disabled={saving || !hasChanges}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* GitHub Connection Warning */}
      {!site.github_installation_id && (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>GitHub Connection Required</AlertTitle>
          <AlertDescription>
            This site needs to be reconnected to GitHub to save changes. Please reconnect in the{" "}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => navigate(`/manage/${siteId}`)}
            >
              manage page
            </Button>
            .
          </AlertDescription>
        </Alert>
      )}

      {/* Editor */}
      <main className="flex-1 overflow-hidden">
        <GrapesEditor
          initialHtml={initialHtml}
          initialCss={initialCss}
          externalStyles={externalStyles}
          externalScripts={externalScripts}
          siteData={siteData}
          githubPagesBaseUrl={githubPagesBaseUrl}
          siteId={siteId || ''}
          onSave={handleSave}
          onUpdate={handleUpdate}
        />
      </main>
    </div>
  );
};

export default SiteEditor;

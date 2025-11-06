import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Folder, FileText, Image, AlertCircle, RefreshCw, GitPullRequest, ExternalLink, Upload } from "lucide-react";
import AssetUploadDialog from "./AssetUploadDialog";
import CreateShareDialog from "./CreateShareDialog";
import type { PendingAssetChange } from "@/pages/Manage";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
}

interface SiteAssetsConfig {
  version: string;
  assets: AssetConfig[];
}

interface AssetManagerProps {
  siteId: string;
  pendingChanges: PendingAssetChange[];
  setPendingChanges: (changes: PendingAssetChange[]) => void;
}

const AssetManager = ({ siteId, pendingChanges, setPendingChanges }: AssetManagerProps) => {
  const [loading, setLoading] = useState(false);
  const [creatingPr, setCreatingPr] = useState(false);
  const [config, setConfig] = useState<SiteAssetsConfig | null>(null);
  const [found, setFound] = useState<boolean | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig | null>(null);

  useEffect(() => {
    fetchAssets();
  }, [siteId]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('fetch-site-assets', {
        body: { site_id: siteId },
      });

      if (error) throw error;

      setFound(data.found);
      if (data.found) {
        setConfig(data.config);
      } else {
        toast.info(data.message || "site-assets.json not found");
      }
    } catch (error: any) {
      console.error("Failed to fetch assets:", error);
      setFound(false);
      toast.error(error.message || "Failed to fetch site assets");
    } finally {
      setLoading(false);
    }
  };

  const createTemplatePr = async () => {
    setCreatingPr(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-site-assets-pr', {
        body: { site_id: siteId },
      });

      if (error) throw error;

      toast.success("Pull request created successfully!");
      
      // Open the PR in a new tab
      if (data.pr_url) {
        window.open(data.pr_url, '_blank');
      }
    } catch (error: any) {
      console.error("Failed to create PR:", error);
      toast.error(error.message || "Failed to create pull request");
    } finally {
      setCreatingPr(false);
    }
  };

  const getAssetIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'image':
      case 'img':
        return <Image className="h-5 w-5 text-blue-500" />;
      case 'directory':
      case 'folder':
        return <Folder className="h-5 w-5 text-yellow-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'No limit';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Asset Manager</CardTitle>
              <CardDescription>
                Manage site assets defined in site-assets.json
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAssets}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Load</span>
              </Button>
              <Button
                size="sm"
                onClick={createTemplatePr}
                disabled={creatingPr}
                className="text-xs sm:text-sm"
              >
                {creatingPr ? (
                  <>
                    <RefreshCw className="mr-1 sm:mr-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Creating...</span>
                    <span className="sm:hidden">PR...</span>
                  </>
                ) : (
                  <>
                    <GitPullRequest className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Create Template PR</span>
                    <span className="sm:hidden">Template PR</span>
                  </>
                )}
              </Button>
            </div>
          </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : found === false ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Asset Configuration Found</AlertTitle>
            <AlertDescription>
              <p className="mb-3">
                No <code className="bg-muted px-1 py-0.5 rounded">site-assets.json</code> file found in the repository root.
                Create this file to define manageable assets for your site.
              </p>
              
              <Button 
                onClick={createTemplatePr} 
                disabled={creatingPr}
                className="mb-3"
              >
                {creatingPr ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating PR...
                  </>
                ) : (
                  <>
                    <GitPullRequest className="mr-2 h-4 w-4" />
                    Create Template PR
                  </>
                )}
              </Button>

              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                <p className="text-xs font-medium mb-2">Example site-assets.json:</p>
                <pre className="text-xs overflow-x-auto">
{`{
  "version": "1.0",
  "description": "Configuration file for site assets",
  "assets": [
    {
      "path": "images/hero.jpg",
      "type": "image",
      "label": "Hero Image",
      "description": "Main homepage hero image",
      "maxSize": 2097152,
      "allowedExtensions": [".jpg", ".png", ".webp"]
    },
    {
      "path": "content/about.md",
      "type": "text",
      "label": "About Page",
      "description": "About page content",
      "maxSize": 51200,
      "allowedExtensions": [".md"]
    }
  ]
}`}
                </pre>
              </div>
            </AlertDescription>
          </Alert>
        ) : config ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">Version {config.version}</Badge>
              <span>•</span>
              <span>{config.assets.length} asset{config.assets.length !== 1 ? 's' : ''} defined</span>
            </div>

            <div className="space-y-3">
              {config.assets.map((asset, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getAssetIcon(asset.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-sm truncate">{asset.label || asset.path}</p>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {asset.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mb-1 break-all">
                      {asset.path}
                    </p>
                    {asset.description && (
                      <p className="text-xs text-muted-foreground">
                        {asset.description}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Max: {formatFileSize(asset.maxSize)}</span>
                      {asset.allowedExtensions && (
                        <span className="break-all">
                          Allowed: {asset.allowedExtensions.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedAsset(asset);
                        setUploadDialogOpen(true);
                      }}
                      className="flex-1 sm:flex-initial"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                    <CreateShareDialog 
                      siteId={siteId}
                      assetPath={asset.path.includes('/') ? asset.path.substring(0, asset.path.lastIndexOf('/')) : '.'}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Click "Load Assets" to fetch the site asset configuration</p>
          </div>
        )}
      </CardContent>

      {selectedAsset && (
        <AssetUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          asset={selectedAsset}
          siteId={siteId}
          pendingChanges={pendingChanges}
          setPendingChanges={setPendingChanges}
          onSuccess={() => {
            fetchAssets();
            toast.success("Asset updated successfully!");
          }}
        />
      )}
    </Card>
  );
};

export default AssetManager;

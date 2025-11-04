import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Folder, FileText, Image, AlertCircle, RefreshCw, GitPullRequest, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

interface AssetManagerSidebarProps {
  siteId: string;
  pendingChanges: PendingAssetChange[];
  setPendingChanges: (changes: PendingAssetChange[]) => void;
}

const AssetManagerSidebar = ({ siteId, pendingChanges, setPendingChanges }: AssetManagerSidebarProps) => {
  const [loading, setLoading] = useState(false);
  const [creatingPr, setCreatingPr] = useState(false);
  const [config, setConfig] = useState<SiteAssetsConfig | null>(null);
  const [found, setFound] = useState<boolean | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig | null>(null);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAssets();
  }, [siteId]);

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedAssets);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedAssets(newExpanded);
  };

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
        toast.success("Site assets loaded");
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

      toast.success("Pull request created!");
      
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
        return <Image className="h-4 w-4 text-blue-500" />;
      case 'directory':
      case 'folder':
        return <Folder className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'No limit';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (found === false) {
    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="text-sm">No Asset Configuration</AlertTitle>
        <AlertDescription className="text-xs">
          <p className="mb-2">
            No <code className="bg-muted px-1 py-0.5 rounded text-xs">site-assets.json</code> found.
          </p>
          
          <Button 
            onClick={createTemplatePr} 
            disabled={creatingPr}
            size="sm"
            className="w-full"
          >
            {creatingPr ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <GitPullRequest className="mr-2 h-3 w-3" />
                Create Template PR
              </>
            )}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-xs">Click "Refresh" to load assets</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">v{config.version}</Badge>
          <span className="text-xs text-muted-foreground">{config.assets.length} assets</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchAssets}
          disabled={loading}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-2">
        {config.assets.map((asset, index) => {
          const isExpanded = expandedAssets.has(asset.path);
          
          return (
            <Collapsible
              key={index}
              open={isExpanded}
              onOpenChange={() => toggleExpanded(asset.path)}
            >
              <div className="border border-border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-shrink-0 mt-0.5">
                      {getAssetIcon(asset.type)}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{asset.label || asset.path}</p>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {asset.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {asset.path}
                      </p>
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="p-3 pt-0 space-y-2">
                    {asset.description && (
                      <p className="text-xs text-muted-foreground">
                        {asset.description}
                      </p>
                    )}
                    
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span>Max size: {formatFileSize(asset.maxSize)}</span>
                      {asset.allowedExtensions && (
                        <span>Types: {asset.allowedExtensions.join(', ')}</span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => {
                          setSelectedAsset(asset);
                          setUploadDialogOpen(true);
                        }}
                        className="flex-1"
                      >
                        <Upload className="mr-2 h-3 w-3" />
                        Upload
                      </Button>
                      <CreateShareDialog 
                        siteId={siteId}
                        assetPath={asset.path.includes('/') ? asset.path.substring(0, asset.path.lastIndexOf('/')) : '.'}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

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
            toast.success("Asset updated!");
          }}
        />
      )}
    </div>
  );
};

export default AssetManagerSidebar;

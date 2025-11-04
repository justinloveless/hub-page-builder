import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Folder, FileText, Image, AlertCircle, RefreshCw, GitPullRequest, ChevronDown, ChevronRight, Plus, Trash2, File } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [assetContents, setAssetContents] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAssets();
  }, [siteId]);

  const toggleExpanded = async (asset: AssetConfig) => {
    const newExpanded = new Set(expandedAssets);
    if (newExpanded.has(asset.path)) {
      newExpanded.delete(asset.path);
    } else {
      newExpanded.add(asset.path);
      // Load content when expanding if it's a text/json asset
      if ((asset.type === 'text' || asset.type === 'json' || asset.type === 'markdown') && !assetContents[asset.path]) {
        await loadAssetContent(asset.path);
      }
    }
    setExpandedAssets(newExpanded);
  };

  const loadAssetContent = async (path: string) => {
    setLoadingContent(prev => ({ ...prev, [path]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: path },
      });

      if (error) throw error;

      if (data.found) {
        setAssetContents(prev => ({ ...prev, [path]: data.content }));
      }
    } catch (error: any) {
      console.error("Failed to load content:", error);
    } finally {
      setLoadingContent(prev => ({ ...prev, [path]: false }));
    }
  };

  const handleContentChange = async (asset: AssetConfig, newContent: string) => {
    setAssetContents(prev => ({ ...prev, [asset.path]: newContent }));
    
    // Auto-save to batch
    const base64Content = btoa(unescape(encodeURIComponent(newContent)));
    const fileName = asset.path.split('/').pop() || 'file';
    
    // Fetch original content for diff
    let originalContent = "";
    try {
      const { data: originalData } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: asset.path },
      });
      if (originalData?.found) {
        originalContent = originalData.content;
      }
    } catch (error) {
      console.error("Failed to fetch original content:", error);
    }

    const newChange: PendingAssetChange = {
      repoPath: asset.path,
      content: base64Content,
      originalContent: originalContent ? btoa(unescape(encodeURIComponent(originalContent))) : undefined,
      fileName
    };
    
    const updatedChanges = pendingChanges.filter(c => c.repoPath !== asset.path);
    setPendingChanges([...updatedChanges, newChange]);
    toast.success("Saved to batch");
  };

  const handleFileUpload = async (asset: AssetConfig, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      
      let fullPath = asset.path;
      if (asset.type === 'directory' || asset.path.endsWith('/')) {
        const basePath = asset.path.endsWith('/') ? asset.path : asset.path + '/';
        fullPath = basePath + file.name;
      }

      const newChange: PendingAssetChange = {
        repoPath: fullPath,
        content: base64,
        fileName: file.name
      };
      
      const updatedChanges = pendingChanges.filter(c => c.repoPath !== fullPath);
      setPendingChanges([...updatedChanges, newChange]);
      toast.success("Added to batch");
    };
    reader.readAsDataURL(file);
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
          const isTextAsset = asset.type === 'text' || asset.type === 'json' || asset.type === 'markdown';
          const isImageAsset = asset.type === 'image' || asset.type === 'img';
          const isDirectoryAsset = asset.type === 'directory' || asset.type === 'folder';
          
          return (
            <Collapsible
              key={index}
              open={isExpanded}
              onOpenChange={() => toggleExpanded(asset)}
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
                  <div className="p-3 pt-0 space-y-3">
                    {asset.description && (
                      <p className="text-xs text-muted-foreground">
                        {asset.description}
                      </p>
                    )}
                    
                    {/* Text/JSON/Markdown inline editor */}
                    {isTextAsset && (
                      <div className="space-y-2">
                        <Label className="text-xs">Current Content</Label>
                        {loadingContent[asset.path] ? (
                          <Skeleton className="h-24 w-full" />
                        ) : (
                          <Textarea
                            value={assetContents[asset.path] || ''}
                            onChange={(e) => setAssetContents(prev => ({ ...prev, [asset.path]: e.target.value }))}
                            onBlur={(e) => handleContentChange(asset, e.target.value)}
                            placeholder="Enter content..."
                            className="min-h-[100px] font-mono text-xs"
                          />
                        )}
                        <p className="text-xs text-muted-foreground">Changes are automatically saved to batch</p>
                      </div>
                    )}

                    {/* Image/File upload */}
                    {(isImageAsset || isDirectoryAsset) && (
                      <div className="space-y-2">
                        <Label htmlFor={`file-${index}`} className="text-xs">
                          {isDirectoryAsset ? 'Add File' : 'Upload Image'}
                        </Label>
                        <Input
                          id={`file-${index}`}
                          type="file"
                          accept={asset.allowedExtensions?.join(',') || '*'}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validate file size
                              if (asset.maxSize && file.size > asset.maxSize) {
                                toast.error(`File size exceeds maximum of ${(asset.maxSize / 1024 / 1024).toFixed(1)} MB`);
                                return;
                              }
                              handleFileUpload(asset, file);
                              e.target.value = ''; // Reset input
                            }
                          }}
                          className="text-xs"
                        />
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span>Max size: {formatFileSize(asset.maxSize)}</span>
                          {asset.allowedExtensions && (
                            <span>Types: {asset.allowedExtensions.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    )}

                    <CreateShareDialog 
                      siteId={siteId}
                      assetPath={asset.path.includes('/') ? asset.path.substring(0, asset.path.lastIndexOf('/')) : '.'}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};

export default AssetManagerSidebar;

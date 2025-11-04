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
  schema?: Record<string, any>;
}

interface AssetFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  download_url: string;
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
  const [jsonFormData, setJsonFormData] = useState<Record<string, Record<string, any>>>({});
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [directoryFiles, setDirectoryFiles] = useState<Record<string, AssetFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAssets();
  }, [siteId]);

  const toggleExpanded = async (asset: AssetConfig) => {
    const newExpanded = new Set(expandedAssets);
    if (newExpanded.has(asset.path)) {
      newExpanded.delete(asset.path);
    } else {
      newExpanded.add(asset.path);
      // Load content when expanding
      if ((asset.type === 'text' || asset.type === 'json' || asset.type === 'markdown') && !assetContents[asset.path]) {
        await loadAssetContent(asset);
      }
      // Load directory files when expanding
      if ((asset.type === 'directory' || asset.type === 'folder') && !directoryFiles[asset.path]) {
        await loadDirectoryFiles(asset);
      }
      // Load image when expanding
      if ((asset.type === 'image' || asset.type === 'img') && !imageUrls[asset.path]) {
        await loadImageAsset(asset);
      }
    }
    setExpandedAssets(newExpanded);
  };

  const loadImageAsset = async (asset: AssetConfig) => {
    setLoadingContent(prev => ({ ...prev, [asset.path]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: asset.path },
      });

      if (error) throw error;

      if (data.found && data.download_url) {
        // Use the download_url from GitHub directly, just like directory assets do
        setImageUrls(prev => ({ ...prev, [asset.path]: data.download_url }));
      }
    } catch (error: any) {
      console.error("Failed to load image:", error);
      toast.error("Failed to load image");
    } finally {
      setLoadingContent(prev => ({ ...prev, [asset.path]: false }));
    }
  };

  const loadDirectoryFiles = async (asset: AssetConfig) => {
    setLoadingFiles(prev => ({ ...prev, [asset.path]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('list-directory-assets', {
        body: { site_id: siteId, asset_path: asset.path },
      });

      if (error) throw error;
      setDirectoryFiles(prev => ({ ...prev, [asset.path]: data.files || [] }));
    } catch (error: any) {
      console.error('Error loading directory files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoadingFiles(prev => ({ ...prev, [asset.path]: false }));
    }
  };

  const handleDeleteFile = async (asset: AssetConfig, filePath: string, sha: string) => {
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;

    setDeletingFile(filePath);
    try {
      const { error } = await supabase.functions.invoke('delete-site-asset', {
        body: {
          site_id: siteId,
          file_path: filePath,
          sha: sha,
          message: `Delete ${filePath}`,
        },
      });

      if (error) throw error;

      toast.success("File deleted successfully");
      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error(error.message || "Failed to delete file");
    } finally {
      setDeletingFile(null);
    }
  };

  const loadAssetContent = async (asset: AssetConfig) => {
    setLoadingContent(prev => ({ ...prev, [asset.path]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: asset.path },
      });

      if (error) throw error;

      if (data.found) {
        setAssetContents(prev => ({ ...prev, [asset.path]: data.content }));

        // Parse JSON for schema-based editing
        if (asset.type === 'json' && asset.schema) {
          try {
            const parsed = JSON.parse(data.content);
            setJsonFormData(prev => ({ ...prev, [asset.path]: parsed }));
          } catch (e) {
            console.error("Failed to parse JSON:", e);
            setJsonFormData(prev => ({ ...prev, [asset.path]: {} }));
          }
        }
      }
    } catch (error: any) {
      console.error("Failed to load content:", error);
    } finally {
      setLoadingContent(prev => ({ ...prev, [asset.path]: false }));
    }
  };

  const handleContentChange = async (asset: AssetConfig, newContent: string) => {
    setAssetContents(prev => ({ ...prev, [asset.path]: newContent }));
    await saveToBatch(asset, newContent);
  };

  const handleJsonFormChange = async (asset: AssetConfig, jsonData?: Record<string, any>) => {
    // Use provided jsonData or fall back to state
    const dataToUse = jsonData ?? jsonFormData[asset.path];
    const newContent = JSON.stringify(dataToUse, null, 2);
    setAssetContents(prev => ({ ...prev, [asset.path]: newContent }));
    await saveToBatch(asset, newContent);
  };

  const saveToBatch = async (asset: AssetConfig, content: string) => {
    const base64Content = btoa(unescape(encodeURIComponent(content)));
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

  const addNewEntry = async (asset: AssetConfig) => {
    const newKey = newKeys[asset.path] || '';
    if (!newKey.trim()) {
      toast.error("Key cannot be empty");
      return;
    }
    const currentData = jsonFormData[asset.path] || {};
    if (currentData[newKey]) {
      toast.error("Key already exists");
      return;
    }

    const additionalPropsSchema = asset.schema?.additionalProperties;
    let defaultValue = {};

    if (additionalPropsSchema?.type === 'object' && additionalPropsSchema.properties) {
      Object.entries(additionalPropsSchema.properties).forEach(([propKey, propSchema]: [string, any]) => {
        defaultValue[propKey] = propSchema.default ?? '';
      });
    }

    const updatedData = { ...currentData, [newKey]: defaultValue };
    setJsonFormData(prev => ({
      ...prev,
      [asset.path]: updatedData
    }));
    setNewKeys(prev => ({ ...prev, [asset.path]: '' }));
    toast.success(`Added "${newKey}"`);
    await handleJsonFormChange(asset, updatedData);
  };

  const removeEntry = async (asset: AssetConfig, key: string) => {
    const currentData = jsonFormData[asset.path] || {};
    const updated = { ...currentData };
    delete updated[key];
    setJsonFormData(prev => ({
      ...prev,
      [asset.path]: updated
    }));
    toast.success(`Removed "${key}"`);
    await handleJsonFormChange(asset, updated);
  };

  const renderSchemaField = (asset: AssetConfig, key: string, fieldSchema: any, parentKey?: string) => {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;
    const assetData = jsonFormData[asset.path] || {};
    const value = parentKey
      ? assetData[parentKey]?.[key] ?? fieldSchema.default ?? ''
      : assetData[key] ?? fieldSchema.default ?? '';

    const updateValue = async (newValue: any) => {
      let updatedData: Record<string, any>;
      if (parentKey) {
        updatedData = {
          ...(jsonFormData[asset.path] || {}),
          [parentKey]: {
            ...(jsonFormData[asset.path]?.[parentKey] || {}),
            [key]: newValue
          }
        };
        setJsonFormData(prev => ({
          ...prev,
          [asset.path]: updatedData
        }));
      } else {
        updatedData = { ...(jsonFormData[asset.path] || {}), [key]: newValue };
        setJsonFormData(prev => ({
          ...prev,
          [asset.path]: updatedData
        }));
      }
      await handleJsonFormChange(asset, updatedData);
    };

    switch (fieldSchema.type) {
      case 'object':
        if (fieldSchema.properties) {
          return (
            <div key={fullKey} className="space-y-2 p-3 border rounded-lg bg-accent/5">
              <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                {fieldSchema.title || key}
              </h4>
              {fieldSchema.description && (
                <p className="text-xs text-muted-foreground -mt-1">{fieldSchema.description}</p>
              )}
              <div className="space-y-2 pl-2">
                {Object.entries(fieldSchema.properties).map(([nestedKey, nestedSchema]: [string, any]) =>
                  renderSchemaField(asset, nestedKey, nestedSchema, key)
                )}
              </div>
            </div>
          );
        }
        return null;

      case 'string':
        if (fieldSchema.enum) {
          return (
            <div key={fullKey} className="space-y-1">
              <Label htmlFor={fullKey} className="text-xs">
                {fieldSchema.title || key}
              </Label>
              {fieldSchema.description && (
                <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
              )}
              <select
                id={fullKey}
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="">Select...</option>
                {fieldSchema.enum.map((option: string) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          );
        }
        return (
          <div key={fullKey} className="space-y-1">
            <Label htmlFor={fullKey} className="text-xs">
              {fieldSchema.title || key}
            </Label>
            {fieldSchema.description && (
              <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
            )}
            {fieldSchema.multiline ? (
              <Textarea
                id={fullKey}
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                placeholder={fieldSchema.placeholder}
                className="min-h-[80px] text-xs"
              />
            ) : (
              <Input
                id={fullKey}
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                placeholder={fieldSchema.placeholder}
                className="h-9 text-xs"
              />
            )}
          </div>
        );

      case 'number':
      case 'integer':
        return (
          <div key={fullKey} className="space-y-1">
            <Label htmlFor={fullKey} className="text-xs">
              {fieldSchema.title || key}
            </Label>
            {fieldSchema.description && (
              <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
            )}
            <Input
              id={fullKey}
              type="number"
              value={value}
              onChange={(e) => updateValue(fieldSchema.type === 'integer' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
              placeholder={fieldSchema.placeholder}
              min={fieldSchema.minimum}
              max={fieldSchema.maximum}
              className="h-9 text-xs"
            />
          </div>
        );

      default:
        return null;
    }
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

  const isImageFile = (fileName: string): boolean => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
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
    <div className="space-y-3 w-full max-w-full">
      <div className="flex items-center justify-between mb-3 gap-2 w-full max-w-full">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <Badge variant="secondary" className="text-xs flex-shrink-0">v{config.version}</Badge>
          <span className="text-xs text-muted-foreground whitespace-nowrap truncate">{config.assets.length} assets</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchAssets}
          disabled={loading}
          className="h-7 w-7 p-0 flex-shrink-0"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-2 w-full max-w-full">
        {config.assets.map((asset, index) => {
          const isExpanded = expandedAssets.has(asset.path);
          const isJsonWithSchema = asset.type === 'json' && asset.schema;
          const isTextAsset = (asset.type === 'text' || asset.type === 'markdown') && !isJsonWithSchema;
          const isImageAsset = asset.type === 'image' || asset.type === 'img';
          const isDirectoryAsset = asset.type === 'directory' || asset.type === 'folder';

          return (
            <Collapsible
              key={index}
              open={isExpanded}
              onOpenChange={() => toggleExpanded(asset)}
              className="w-full"
            >
              <div className="border border-border rounded-lg overflow-hidden w-full">
                <CollapsibleTrigger className="w-full p-3 hover:bg-muted/50 transition-colors max-w-full">
                  <div className="flex items-start gap-2 w-full max-w-full">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-shrink-0 mt-0.5">
                      {getAssetIcon(asset.type)}
                    </div>
                    <div className="flex-1 text-left min-w-0 max-w-full overflow-hidden">
                      <div className="flex items-center gap-2 mb-1 w-full max-w-full">
                        <p className="font-medium text-sm truncate flex-1 min-w-0">{asset.label || asset.path}</p>
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

                    {/* JSON with Schema - Form Editor */}
                    {isJsonWithSchema && (
                      <div className="space-y-3">
                        {loadingContent[asset.path] ? (
                          <Skeleton className="h-32 w-full" />
                        ) : (
                          <>
                            {asset.schema.properties && (
                              <div className="space-y-2">
                                {Object.entries(asset.schema.properties).map(([key, fieldSchema]: [string, any]) =>
                                  renderSchemaField(asset, key, fieldSchema)
                                )}
                              </div>
                            )}

                            {asset.schema.additionalProperties && (
                              <div className="space-y-2 pt-2 border-t">
                                <Label className="text-xs font-semibold">Entries</Label>
                                {Object.keys(jsonFormData[asset.path] || {}).map((key) => (
                                  <div key={key} className="p-2 border rounded-lg space-y-2 w-full">
                                    <div className="flex items-center justify-between gap-2 w-full">
                                      <Label className="text-xs font-semibold truncate flex-1 min-w-0">{key}</Label>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeEntry(asset, key)}
                                        className="h-6 w-6 p-0 flex-shrink-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    {asset.schema.additionalProperties.properties && (
                                      <div className="space-y-2 pl-2">
                                        {Object.entries(asset.schema.additionalProperties.properties).map(([nestedKey, nestedSchema]: [string, any]) =>
                                          renderSchemaField(asset, nestedKey, nestedSchema, key)
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}

                                <div className="flex gap-2 pt-2 w-full">
                                  <Input
                                    placeholder="New key..."
                                    value={newKeys[asset.path] || ''}
                                    onChange={(e) => setNewKeys(prev => ({ ...prev, [asset.path]: e.target.value }))}
                                    className="h-8 text-xs flex-1 min-w-0"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addNewEntry(asset)}
                                    className="h-8 flex-shrink-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">Changes are automatically saved to batch</p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Text/Markdown inline editor */}
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

                    {/* Image upload */}
                    {isImageAsset && (
                      <div className="space-y-3">
                        {loadingContent[asset.path] ? (
                          <Skeleton className="h-48 w-full" />
                        ) : (
                          <>
                            {imageUrls[asset.path] && (
                              <div className="space-y-2">
                                <Label className="text-xs">Current Image</Label>
                                <div className="relative border rounded-lg overflow-hidden">
                                  <img
                                    src={imageUrls[asset.path]}
                                    alt={asset.label || asset.path}
                                    className="w-full h-auto"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label htmlFor={`file-${index}`} className="text-xs">
                                {imageUrls[asset.path] ? 'Replace Image' : 'Upload Image'}
                              </Label>
                              <Input
                                id={`file-${index}`}
                                type="file"
                                accept={asset.allowedExtensions?.join(',') || 'image/*'}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (asset.maxSize && file.size > asset.maxSize) {
                                      toast.error(`File size exceeds maximum of ${(asset.maxSize / 1024 / 1024).toFixed(1)} MB`);
                                      return;
                                    }
                                    handleFileUpload(asset, file);
                                    e.target.value = '';
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
                          </>
                        )}
                      </div>
                    )}

                    {/* Directory with file list */}
                    {isDirectoryAsset && (
                      <div className="space-y-3">
                        {loadingFiles[asset.path] ? (
                          <Skeleton className="h-20 w-full" />
                        ) : (
                          <>
                            {directoryFiles[asset.path] && directoryFiles[asset.path].length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs">Existing Files</Label>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {directoryFiles[asset.path].map((file) => (
                                    <div key={file.path} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50 w-full max-w-full">
                                      {isImageFile(file.name) ? (
                                        <img
                                          src={file.download_url}
                                          alt={file.name}
                                          className="w-12 h-12 object-cover rounded border flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="w-12 h-12 flex items-center justify-center bg-muted rounded border flex-shrink-0">
                                          <File className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0 overflow-hidden">
                                        <p className="text-xs font-medium truncate">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {(file.size / 1024).toFixed(1)} KB
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => window.open(file.download_url, '_blank')}
                                          className="h-7 w-7 p-0"
                                          title="Open file"
                                        >
                                          <FileText className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteFile(asset, file.path, file.sha)}
                                          disabled={deletingFile === file.path}
                                          className="h-7 w-7 p-0"
                                          title="Delete file"
                                        >
                                          {deletingFile === file.path ? (
                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label htmlFor={`file-${index}`} className="text-xs">
                                Add New File
                              </Label>
                              <Input
                                id={`file-${index}`}
                                type="file"
                                accept={asset.allowedExtensions?.join(',') || '*'}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (asset.maxSize && file.size > asset.maxSize) {
                                      toast.error(`File size exceeds maximum of ${(asset.maxSize / 1024 / 1024).toFixed(1)} MB`);
                                      return;
                                    }
                                    handleFileUpload(asset, file);
                                    e.target.value = '';
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
                          </>
                        )}
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

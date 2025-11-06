import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Folder, FileText, Image, AlertCircle, RefreshCw, GitPullRequest, ChevronDown, ChevronRight, Plus, Trash2, File, Users, Edit, GripVertical } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CreateShareDialog from "./CreateShareDialog";
import type { PendingAssetChange } from "@/pages/Manage";
import { useSiteAssets } from "@/hooks/useSiteAssets";
import { useQueryClient } from "@tanstack/react-query";
import { useAssetContent } from "@/hooks/useAssetContent";
import { useDirectoryFiles } from "@/hooks/useDirectoryFiles";
import { usePrefetchAssets } from "@/hooks/usePrefetchAssets";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
  schema?: Record<string, any>;
  contains?: {
    type: string;
    parts?: Array<{
      assetType: string;
      allowedExtensions?: string[];
      maxSize?: number;
      schema?: Record<string, any>;
    }>;
  };
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
  const queryClient = useQueryClient();
  const { data: assetsData, isLoading: loading, refetch } = useSiteAssets(siteId);
  const [creatingPr, setCreatingPr] = useState(false);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [assetContents, setAssetContents] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});
  const [jsonFormData, setJsonFormData] = useState<Record<string, Record<string, any>>>({});
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [directoryFiles, setDirectoryFiles] = useState<Record<string, AssetFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [comboFileContents, setComboFileContents] = useState<Record<string, string>>({});
  const [loadingComboFile, setLoadingComboFile] = useState<Record<string, boolean>>({});
  const [creatingCombo, setCreatingCombo] = useState<Record<string, boolean>>({});
  const [newComboData, setNewComboData] = useState<Record<string, { baseName: string; parts: Record<string, { content: string; file?: File; jsonData?: Record<string, any> }> }>>({});
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [editingComboImage, setEditingComboImage] = useState<{ assetPath: string; filePath: string } | null>(null);

  const found = assetsData?.found ?? null;
  const config = assetsData?.config ?? null;

  // Prefetch all asset content in the background
  usePrefetchAssets(siteId, config?.assets);

  const handleRefresh = async () => {
    await refetch();
  };

  const toggleExpanded = async (asset: AssetConfig) => {
    const newExpanded = new Set(expandedAssets);
    if (newExpanded.has(asset.path)) {
      newExpanded.delete(asset.path);
    } else {
      newExpanded.add(asset.path);
      
      // Check cache first, then load if not cached
      const cachedContent = queryClient.getQueryData(['asset-content', siteId, asset.path]);
      const cachedFiles = queryClient.getQueryData(['directory-files', siteId, asset.path]);
      
      // Load content when expanding if not already in cache
      if ((asset.type === 'text' || asset.type === 'json' || asset.type === 'markdown') && !assetContents[asset.path] && !cachedContent) {
        await loadAssetContent(asset);
      } else if (cachedContent && !assetContents[asset.path]) {
        // Use cached content
        const data = cachedContent as any;
        if (data.found) {
          setAssetContents(prev => ({ ...prev, [asset.path]: data.content }));
          if (asset.type === 'json' && asset.schema) {
            try {
              const parsed = JSON.parse(data.content);
              setJsonFormData(prev => ({ ...prev, [asset.path]: parsed }));
            } catch (e) {
              console.error("Failed to parse JSON:", e);
            }
          }
        }
      }
      
      // Load directory files when expanding if not already in cache
      if ((asset.type === 'directory' || asset.type === 'folder') && !directoryFiles[asset.path] && !cachedFiles) {
        await loadDirectoryFiles(asset);
      } else if (cachedFiles && !directoryFiles[asset.path]) {
        // Use cached files
        setDirectoryFiles(prev => ({ ...prev, [asset.path]: cachedFiles as any }));
      }
      
      // Load image when expanding if not already loaded
      if ((asset.type === 'image' || asset.type === 'img') && !imageUrls[asset.path]) {
        const cachedImage = queryClient.getQueryData(['asset-content', siteId, asset.path]);
        if (cachedImage) {
          const data = cachedImage as any;
          if (data.found && data.download_url) {
            setImageUrls(prev => ({ ...prev, [asset.path]: data.download_url }));
          }
        } else {
          await loadImageAsset(asset);
        }
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

  const handleDeleteComboAsset = async (asset: AssetConfig, baseName: string, files: AssetFile[]) => {
    if (!confirm(`Are you sure you want to delete all parts of "${baseName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      for (const file of files) {
        const { error } = await supabase.functions.invoke('delete-site-asset', {
          body: {
            site_id: siteId,
            file_path: file.path,
            sha: file.sha,
            message: `Delete ${file.path}`,
          },
        });
        if (error) throw error;
      }

      toast.success(`Deleted combo asset "${baseName}"`);
      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error('Error deleting combo asset:', error);
      toast.error(error.message || "Failed to delete combo asset");
    }
  };

  const handleReorderDirectoryItems = async (asset: AssetConfig, files: AssetFile[], newOrder: number[]) => {
    try {
      const reorderedFiles = newOrder.map(index => files[index]);
      
      const manifestContent = {
        files: reorderedFiles.map(file => file.name)
      };

      const manifestBlob = new Blob([JSON.stringify(manifestContent, null, 2)], { type: 'application/json' });
      const manifestPath = `${asset.path}/manifest.json`;
      
      const base64Content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.readAsDataURL(manifestBlob);
      });

      await saveToBatch({ 
        ...asset, 
        path: manifestPath 
      }, atob(base64Content));

      toast.success("Directory order updated - changes saved to batch");
      setDraggedItem(null);
      setDragOverItem(null);
      
      // Refresh the directory files
      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error("Failed to update directory order:", error);
      toast.error(error.message || "Failed to update directory order");
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

  const renderSchemaField = (asset: AssetConfig, key: string, fieldSchema: any, parentKey?: string, arrayIndex?: number) => {
    const fullKey = parentKey
      ? (arrayIndex !== undefined ? `${parentKey}[${arrayIndex}].${key}` : `${parentKey}.${key}`)
      : key;
    const assetData = jsonFormData[asset.path] || {};

    let value: any;
    if (arrayIndex !== undefined && parentKey) {
      value = assetData[parentKey]?.[arrayIndex]?.[key] ?? fieldSchema.default ?? '';
    } else if (parentKey) {
      value = assetData[parentKey]?.[key] ?? fieldSchema.default ?? '';
    } else {
      value = assetData[key] ?? fieldSchema.default ?? '';
    }

    const updateValue = async (newValue: any) => {
      let updatedData: Record<string, any>;
      if (arrayIndex !== undefined && parentKey) {
        const arrayData = [...(jsonFormData[asset.path]?.[parentKey] || [])];
        arrayData[arrayIndex] = {
          ...(arrayData[arrayIndex] || {}),
          [key]: newValue
        };
        updatedData = {
          ...(jsonFormData[asset.path] || {}),
          [parentKey]: arrayData
        };
      } else if (parentKey) {
        updatedData = {
          ...(jsonFormData[asset.path] || {}),
          [parentKey]: {
            ...(jsonFormData[asset.path]?.[parentKey] || {}),
            [key]: newValue
          }
        };
      } else {
        updatedData = { ...(jsonFormData[asset.path] || {}), [key]: newValue };
      }
      setJsonFormData(prev => ({
        ...prev,
        [asset.path]: updatedData
      }));
      await handleJsonFormChange(asset, updatedData);
    };

    switch (fieldSchema.type) {
      case 'array':
        if (fieldSchema.items) {
          const arrayValue = parentKey ? assetData[parentKey]?.[key] : assetData[key];
          const items = Array.isArray(arrayValue) ? arrayValue : [];

          const addArrayItem = async () => {
            const newItem: any = {};
            if (fieldSchema.items.type === 'object' && fieldSchema.items.properties) {
              Object.entries(fieldSchema.items.properties).forEach(([propKey, propSchema]: [string, any]) => {
                newItem[propKey] = propSchema.default ?? '';
              });
            }

            const newItems = [...items, newItem];
            const updatedData = parentKey
              ? { ...(jsonFormData[asset.path] || {}), [parentKey]: { ...(jsonFormData[asset.path]?.[parentKey] || {}), [key]: newItems } }
              : { ...(jsonFormData[asset.path] || {}), [key]: newItems };

            setJsonFormData(prev => ({
              ...prev,
              [asset.path]: updatedData
            }));
            await handleJsonFormChange(asset, updatedData);
          };

          const removeArrayItem = async (index: number) => {
            const newItems = items.filter((_, i) => i !== index);
            const updatedData = parentKey
              ? { ...(jsonFormData[asset.path] || {}), [parentKey]: { ...(jsonFormData[asset.path]?.[parentKey] || {}), [key]: newItems } }
              : { ...(jsonFormData[asset.path] || {}), [key]: newItems };

            setJsonFormData(prev => ({
              ...prev,
              [asset.path]: updatedData
            }));
            await handleJsonFormChange(asset, updatedData);
          };

          return (
            <div key={fullKey} className="space-y-2 p-3 border rounded-lg bg-accent/5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    {fieldSchema.title || key}
                  </h4>
                  {fieldSchema.description && (
                    <p className="text-xs text-muted-foreground mt-1">{fieldSchema.description}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addArrayItem}
                  className="h-7 flex-shrink-0"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="p-2 border rounded-lg bg-background space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Item {index + 1}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeArrayItem(index)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {fieldSchema.items.type === 'object' && fieldSchema.items.properties && (
                      <div className="space-y-2 pl-2">
                        {Object.entries(fieldSchema.items.properties).map(([propKey, propSchema]: [string, any]) => {
                          const propValue = item[propKey] ?? propSchema.default ?? '';
                          const propFullKey = `${fullKey}[${index}].${propKey}`;

                          const updateArrayItemProp = async (newPropValue: any) => {
                            const newItems = [...items];
                            newItems[index] = { ...newItems[index], [propKey]: newPropValue };
                            const updatedData = parentKey
                              ? { ...(jsonFormData[asset.path] || {}), [parentKey]: { ...(jsonFormData[asset.path]?.[parentKey] || {}), [key]: newItems } }
                              : { ...(jsonFormData[asset.path] || {}), [key]: newItems };

                            setJsonFormData(prev => ({
                              ...prev,
                              [asset.path]: updatedData
                            }));
                            await handleJsonFormChange(asset, updatedData);
                          };

                          return (
                            <div key={propFullKey} className="space-y-1">
                              <Label htmlFor={propFullKey} className="text-xs">
                                {propSchema.title || propKey}
                              </Label>
                              {propSchema.description && (
                                <p className="text-xs text-muted-foreground">{propSchema.description}</p>
                              )}
                              {propSchema.type === 'string' && propSchema.multiline ? (
                                <Textarea
                                  id={propFullKey}
                                  value={propValue}
                                  onChange={(e) => updateArrayItemProp(e.target.value)}
                                  placeholder={propSchema.placeholder}
                                  className="min-h-[60px] text-xs"
                                />
                              ) : propSchema.type === 'number' || propSchema.type === 'integer' ? (
                                <Input
                                  id={propFullKey}
                                  type="number"
                                  value={propValue}
                                  onChange={(e) => updateArrayItemProp(propSchema.type === 'integer' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
                                  placeholder={propSchema.placeholder}
                                  className="h-8 text-xs"
                                />
                              ) : (
                                <Input
                                  id={propFullKey}
                                  value={propValue}
                                  onChange={(e) => updateArrayItemProp(e.target.value)}
                                  placeholder={propSchema.placeholder}
                                  className="h-8 text-xs"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No items yet. Click "Add" to create one.</p>
                )}
              </div>
            </div>
          );
        }
        return null;

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

  const getFileBaseName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  };

  const getFileExtension = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
  };

  const getMergedDirectoryFiles = (assetPath: string): AssetFile[] => {
    const committedFiles = directoryFiles[assetPath] || [];
    const basePath = assetPath.endsWith('/') ? assetPath : assetPath + '/';

    // Get pending changes for this directory
    const pendingFiles = pendingChanges
      .filter(change => change.repoPath.startsWith(basePath))
      .map(change => {
        const ext = change.fileName.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
        const mimeType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` :
          ext === 'json' ? 'application/json' : 'text/plain';

        return {
          name: change.fileName,
          path: change.repoPath,
          sha: 'pending',
          size: Math.floor(change.content.length * 0.75), // Approximate size from base64
          type: 'file',
          download_url: `data:${mimeType};base64,${change.content}`
        };
      });

    // Merge, preferring pending changes over committed files with same path
    const fileMap = new Map<string, AssetFile>();
    committedFiles.forEach(file => fileMap.set(file.path, file));
    pendingFiles.forEach(file => fileMap.set(file.path, file));

    return Array.from(fileMap.values());
  };

  const groupComboAssets = (files: AssetFile[], comboParts: Array<{ assetType: string; allowedExtensions?: string[] }>) => {
    const groups = new Map<string, { files: AssetFile[]; types: string[] }>();
    const standalone: AssetFile[] = [];

    files.forEach(file => {
      const baseName = getFileBaseName(file.name);
      const ext = getFileExtension(file.name);

      // Find which combo part this file belongs to
      const partType = comboParts.find(part =>
        part.allowedExtensions?.some(allowed => ext.toLowerCase() === allowed.toLowerCase())
      )?.assetType;

      if (partType) {
        if (!groups.has(baseName)) {
          groups.set(baseName, { files: [], types: [] });
        }
        const group = groups.get(baseName)!;
        group.files.push(file);
        group.types.push(partType);
      } else {
        standalone.push(file);
      }
    });

    return { groups: Array.from(groups.entries()), standalone };
  };

  const loadComboFileContent = async (filePath: string) => {
    setLoadingComboFile(prev => ({ ...prev, [filePath]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: filePath },
      });

      if (error) throw error;

      if (data.found) {
        setComboFileContents(prev => ({ ...prev, [filePath]: data.content }));
      }
    } catch (error: any) {
      console.error("Failed to load combo file content:", error);
      toast.error("Failed to load file content");
    } finally {
      setLoadingComboFile(prev => ({ ...prev, [filePath]: false }));
    }
  };

  const handleComboFileContentChange = async (filePath: string, newContent: string) => {
    setComboFileContents(prev => ({ ...prev, [filePath]: newContent }));

    const base64Content = btoa(unescape(encodeURIComponent(newContent)));
    const fileName = filePath.split('/').pop() || 'file';

    // Fetch original content for diff
    let originalContent = "";
    try {
      const { data: originalData } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: filePath },
      });
      if (originalData?.found) {
        originalContent = originalData.content;
      }
    } catch (error) {
      console.error("Failed to fetch original content:", error);
    }

    const newChange: PendingAssetChange = {
      repoPath: filePath,
      content: base64Content,
      originalContent: originalContent ? btoa(unescape(encodeURIComponent(originalContent))) : undefined,
      fileName
    };

    const updatedChanges = pendingChanges.filter(c => c.repoPath !== filePath);
    setPendingChanges([...updatedChanges, newChange]);
    toast.success("Saved to batch");
  };

  const getFileAssetType = (fileName: string, comboParts: Array<{ assetType: string; allowedExtensions?: string[] }>) => {
    const ext = getFileExtension(fileName);
    return comboParts.find(part =>
      part.allowedExtensions?.some(allowed => ext.toLowerCase() === allowed.toLowerCase())
    )?.assetType;
  };

  const startCreatingCombo = (asset: AssetConfig) => {
    setCreatingCombo(prev => ({ ...prev, [asset.path]: true }));

    // Initialize parts with default values based on schema
    const parts: Record<string, { content: string; file?: File; jsonData?: Record<string, any> }> = {};

    asset.contains?.parts?.forEach(part => {
      if (part.assetType === 'json' && part.schema?.properties) {
        // Initialize JSON data with default values from schema
        const jsonData: Record<string, any> = {};
        Object.entries(part.schema.properties).forEach(([key, fieldSchema]: [string, any]) => {
          jsonData[key] = fieldSchema.default ?? '';
        });
        parts[part.assetType] = { content: '', jsonData };
      }
    });

    setNewComboData(prev => ({
      ...prev,
      [asset.path]: {
        baseName: '',
        parts
      }
    }));
  };

  const cancelCreatingCombo = (assetPath: string) => {
    setCreatingCombo(prev => ({ ...prev, [assetPath]: false }));
    setNewComboData(prev => {
      const updated = { ...prev };
      delete updated[assetPath];
      return updated;
    });
  };

  const submitNewCombo = async (asset: AssetConfig) => {
    const comboData = newComboData[asset.path];
    if (!comboData || !comboData.baseName.trim()) {
      toast.error("Please enter a base name for the combo asset");
      return;
    }

    const parts = asset.contains?.parts || [];
    const basePath = asset.path.endsWith('/') ? asset.path : asset.path + '/';

    // Validate all parts are provided
    for (const part of parts) {
      const ext = part.allowedExtensions?.[0] || '';
      const partKey = part.assetType;
      const partData = comboData.parts[partKey];

      if (!partData) {
        toast.error(`Please provide content for ${part.assetType} part`);
        return;
      }

      // Check if there's actual content
      const hasFile = !!partData.file;
      const hasContent = !!partData.content && partData.content.trim().length > 0;
      const hasJsonData = partData.jsonData && Object.keys(partData.jsonData).length > 0;

      if (!hasFile && !hasContent && !hasJsonData) {
        toast.error(`Please provide content for ${part.assetType} part`);
        return;
      }
    }

    // Create changes for each part
    const changes: PendingAssetChange[] = [];
    const newFileNames: string[] = [];

    for (const part of parts) {
      const ext = part.allowedExtensions?.[0] || '';
      const partKey = part.assetType;
      const partData = comboData.parts[partKey];

      if (!partData) continue;

      const fileName = comboData.baseName + ext;
      const fullPath = basePath + fileName;
      newFileNames.push(fileName);

      let base64Content: string = '';

      if (partData.file) {
        // File upload (image, etc.)
        const reader = new FileReader();
        base64Content = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            resolve((reader.result as string).split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(partData.file!);
        });
      } else {
        // Text/JSON content
        const contentToEncode = partData.jsonData
          ? JSON.stringify(partData.jsonData, null, 2)
          : partData.content;
        base64Content = btoa(unescape(encodeURIComponent(contentToEncode)));
      }

      changes.push({
        repoPath: fullPath,
        content: base64Content,
        fileName: fileName
      });
    }

    // Add all changes to batch
    const updatedChanges = [...pendingChanges];
    changes.forEach(change => {
      const existing = updatedChanges.findIndex(c => c.repoPath === change.repoPath);
      if (existing >= 0) {
        updatedChanges[existing] = change;
      } else {
        updatedChanges.push(change);
      }
    });

    // Update manifest.json to include the new combo asset files
    await updateManifestWithNewFiles(asset.path, newFileNames, updatedChanges);

    setPendingChanges(updatedChanges);
    toast.success(`Added combo asset "${comboData.baseName}" to batch`);
    cancelCreatingCombo(asset.path);

    // Note: No need to reload - the component will re-render with updated pendingChanges
    // which will automatically show the new files via getMergedDirectoryFiles
  };

  const updateManifestWithNewFiles = async (dirPath: string, newFileNames: string[], updatedChanges: PendingAssetChange[]) => {
    const basePath = dirPath.endsWith('/') ? dirPath : dirPath + '/';
    const manifestPath = `${basePath}manifest.json`;

    try {
      // Try to get existing manifest from pending changes first
      let manifestContent = '';
      const existingPendingManifest = updatedChanges.find(c => c.repoPath === manifestPath);

      if (existingPendingManifest) {
        // Decode from base64
        manifestContent = decodeURIComponent(escape(atob(existingPendingManifest.content)));
      } else {
        // Try to fetch from GitHub
        const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
          body: { site_id: siteId, asset_path: manifestPath },
        });

        if (!error && data.found) {
          manifestContent = data.content;
        }
      }

      // Parse or create manifest
      let manifest: { files: string[] };
      if (manifestContent) {
        manifest = JSON.parse(manifestContent);
      } else {
        // Create new manifest if it doesn't exist
        manifest = { files: [] };
      }

      // Add new files if they're not already in the manifest
      let updated = false;
      for (const fileName of newFileNames) {
        if (!manifest.files.includes(fileName)) {
          manifest.files.push(fileName);
          updated = true;
        }
      }

      if (updated) {
        // Sort files
        manifest.files.sort();

        // Encode updated manifest
        const updatedManifestContent = JSON.stringify(manifest, null, 2);
        const base64Manifest = btoa(unescape(encodeURIComponent(updatedManifestContent)));

        // Update or add manifest to pending changes
        const manifestChange: PendingAssetChange = {
          repoPath: manifestPath,
          content: base64Manifest,
          fileName: 'manifest.json'
        };

        const existingIndex = updatedChanges.findIndex(c => c.repoPath === manifestPath);
        if (existingIndex >= 0) {
          updatedChanges[existingIndex] = manifestChange;
        } else {
          updatedChanges.push(manifestChange);
        }

        console.log('[AssetManager] Updated manifest.json with new files:', newFileNames);
      }
    } catch (error) {
      console.error('[AssetManager] Failed to update manifest:', error);
      // Don't fail the whole operation if manifest update fails
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
        <div className="flex items-center gap-1 flex-shrink-0">
          <CreateShareDialog
            siteId={siteId}
            assets={config.assets}
            trigger={
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Users className="h-3 w-3" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-7 w-7 p-0 flex-shrink-0"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
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
                <CollapsibleTrigger className={`w-full p-3 hover:bg-muted/50 transition-colors max-w-full ${isExpanded ? 'sticky top-0 z-10 bg-background shadow-sm' : ''}`}>
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
                            {/* Combo Asset Type */}
                            {asset.contains?.type === 'combo' && asset.contains.parts && getMergedDirectoryFiles(asset.path).length > 0 ? (
                              <>
                                {(() => {
                                  const { groups, standalone } = groupComboAssets(getMergedDirectoryFiles(asset.path), asset.contains.parts);
                                  return (
                                    <>
                                       {groups.length > 0 && (
                                        <div className="space-y-3">
                                          {groups.map(([baseName, group]) => {
                                            // Sort files by type: images first, then text, then json
                                            const sortedFiles = [...group.files].sort((a, b) => {
                                              const aType = getFileAssetType(a.name, asset.contains.parts!);
                                              const bType = getFileAssetType(b.name, asset.contains.parts!);
                                              const aIsImage = aType === 'image' || isImageFile(a.name);
                                              const bIsImage = bType === 'image' || isImageFile(b.name);
                                              const order = { image: 0, text: 1, markdown: 1, json: 2 };
                                              if (aIsImage && !bIsImage) return -1;
                                              if (!aIsImage && bIsImage) return 1;
                                              const aOrder = order[aType as keyof typeof order] ?? 999;
                                              const bOrder = order[bType as keyof typeof order] ?? 999;
                                              return aOrder - bOrder;
                                            });

                                            return (
                                              <div key={baseName} className="p-3 border rounded-lg bg-accent/5 space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <h5 className="text-xs font-semibold truncate">{baseName}</h5>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteComboAsset(asset, baseName, group.files)}
                                                    className="h-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                                <div className="space-y-2">
                                                  {sortedFiles.map((file) => {
                                                    const fileType = getFileAssetType(file.name, asset.contains.parts!);
                                                    const isJson = fileType === 'json';
                                                    const isText = fileType === 'text' || fileType === 'markdown';
                                                    const isImage = fileType === 'image' || isImageFile(file.name);

                                                    // Auto-load content for all parts
                                                    if ((isJson || isText) && !comboFileContents[file.path] && !loadingComboFile[file.path]) {
                                                      loadComboFileContent(file.path);
                                                    }

                                                    return (
                                                      <div key={file.path} className="border rounded bg-background">
                                                        {/* Image Display with Edit Button */}
                                                        {isImage && (
                                                          <div className="relative p-2">
                                                            <img
                                                              src={file.download_url}
                                                              alt={file.name}
                                                              className="w-full h-auto rounded border"
                                                            />
                                                            <Button
                                                              variant="secondary"
                                                              size="sm"
                                                              onClick={() => {
                                                                const input = document.createElement('input');
                                                                input.type = 'file';
                                                                input.accept = 'image/*';
                                                                input.onchange = async (e) => {
                                                                  const newFile = (e.target as HTMLInputElement).files?.[0];
                                                                  if (newFile) {
                                                                    const uploadAsset = { ...asset, path: file.path };
                                                                    await handleFileUpload(uploadAsset, newFile);
                                                                  }
                                                                };
                                                                input.click();
                                                              }}
                                                              className="absolute top-3 right-3"
                                                            >
                                                              <Edit className="h-3 w-3 mr-1" />
                                                              Replace
                                                            </Button>
                                                          </div>
                                                        )}

                                                        {/* Text/Markdown Content */}
                                                        {isText && (
                                                          <div className="p-2 space-y-2">
                                                            {loadingComboFile[file.path] && (
                                                              <Skeleton className="h-20 w-full" />
                                                            )}

                                                            {comboFileContents[file.path] && (
                                                              <>
                                                                <Textarea
                                                                  value={comboFileContents[file.path]}
                                                                  onChange={(e) => setComboFileContents(prev => ({ ...prev, [file.path]: e.target.value }))}
                                                                  onBlur={(e) => handleComboFileContentChange(file.path, e.target.value)}
                                                                  className="min-h-[80px] font-mono text-xs"
                                                                />
                                                                <p className="text-xs text-muted-foreground">Changes are automatically saved to batch</p>
                                                              </>
                                                            )}
                                                          </div>
                                                        )}

                                                        {/* JSON Content */}
                                                        {isJson && (
                                                          <div className="p-2 space-y-2">
                                                            {loadingComboFile[file.path] && (
                                                              <Skeleton className="h-20 w-full" />
                                                            )}

                                                            {comboFileContents[file.path] && (
                                                              <>
                                                                {(() => {
                                                                  try {
                                                                    const jsonData = JSON.parse(comboFileContents[file.path]);
                                                                    return (
                                                                      <div className="space-y-2">
                                                                        {Object.entries(jsonData).map(([key, value]) => (
                                                                          <div key={key} className="space-y-1">
                                                                            <Label className="text-xs">{key}</Label>
                                                                            <Input
                                                                              value={String(value)}
                                                                              onChange={(e) => {
                                                                                const updated = { ...jsonData, [key]: e.target.value };
                                                                                handleComboFileContentChange(file.path, JSON.stringify(updated, null, 2));
                                                                              }}
                                                                              className="h-8 text-xs"
                                                                            />
                                                                          </div>
                                                                        ))}
                                                                      </div>
                                                                    );
                                                                  } catch (e) {
                                                                    return (
                                                                      <Textarea
                                                                        value={comboFileContents[file.path]}
                                                                        onChange={(e) => setComboFileContents(prev => ({ ...prev, [file.path]: e.target.value }))}
                                                                        onBlur={(e) => handleComboFileContentChange(file.path, e.target.value)}
                                                                        className="min-h-[80px] font-mono text-xs"
                                                                        placeholder="Invalid JSON"
                                                                      />
                                                                    );
                                                                  }
                                                                })()}
                                                                <p className="text-xs text-muted-foreground">Changes are automatically saved to batch</p>
                                                              </>
                                                            )}
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {standalone.length > 0 && (
                                        <div className="space-y-2">
                                          <Label className="text-xs">Other Files</Label>
                                          <div className="space-y-1">
                                            {standalone.map((file) => (
                                              <div key={file.path} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50">
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
                                                <div className="flex-1 min-w-0">
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
                                    </>
                                  );
                                })()}
                              </>
                            ) : (
                              /* Standard Directory */
                               getMergedDirectoryFiles(asset.path).length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Existing Files</Label>
                                  <div className="space-y-1">
                                    {getMergedDirectoryFiles(asset.path).map((file, fileIndex) => (
                                      <div 
                                        key={file.path} 
                                        draggable
                                        onDragStart={() => setDraggedItem(fileIndex)}
                                        onDragOver={(e) => { e.preventDefault(); setDragOverItem(fileIndex); }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          if (draggedItem !== null) {
                                            const files = getMergedDirectoryFiles(asset.path);
                                            const newOrder = [...Array(files.length).keys()];
                                            const [removed] = newOrder.splice(draggedItem, 1);
                                            newOrder.splice(fileIndex, 0, removed);
                                            handleReorderDirectoryItems(asset, files, newOrder);
                                          }
                                        }}
                                        className={`flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50 w-full max-w-full cursor-move ${dragOverItem === fileIndex ? 'border-primary' : ''}`}
                                      >
                                        <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
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
                              )
                            )}

                            {/* Add New Assets */}
                            {asset.contains?.type === 'combo' && asset.contains.parts ? (
                              /* Combo Asset Creator */
                              <div className="space-y-3 p-3 border rounded-lg bg-accent/5">
                                {!creatingCombo[asset.path] ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => startCreatingCombo(asset)}
                                    className="w-full"
                                  >
                                    <Plus className="h-3 w-3 mr-2" />
                                    Create New Combo Asset
                                  </Button>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs font-semibold">New Combo Asset</Label>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => cancelCreatingCombo(asset.path)}
                                        className="h-6 px-2 text-xs"
                                      >
                                        Cancel
                                      </Button>
                                    </div>

                                    {/* Base Name Input */}
                                    <div className="space-y-1">
                                      <Label htmlFor="combo-basename" className="text-xs">
                                        Base Name (without extension)
                                      </Label>
                                      <Input
                                        id="combo-basename"
                                        value={newComboData[asset.path]?.baseName || ''}
                                        onChange={(e) => {
                                          setNewComboData(prev => ({
                                            ...prev,
                                            [asset.path]: {
                                              ...prev[asset.path],
                                              baseName: e.target.value,
                                              parts: prev[asset.path]?.parts || {}
                                            }
                                          }));
                                        }}
                                        placeholder="e.g., photo1, document-a"
                                        className="h-8 text-xs"
                                      />
                                    </div>

                                    {/* Parts */}
                                    <div className="space-y-2">
                                      <Label className="text-xs font-semibold">Parts</Label>
                                      {asset.contains.parts.map((part, partIdx) => {
                                        const partKey = part.assetType;
                                        const isImage = partKey === 'image';
                                        const isJson = partKey === 'json';
                                        const isText = partKey === 'text' || partKey === 'markdown';
                                        const hasPart = !!newComboData[asset.path]?.parts[partKey];

                                        return (
                                          <div key={partIdx} className="p-2 border rounded bg-background space-y-2">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">{part.assetType}</Badge>
                                                <span className="text-xs text-muted-foreground">
                                                  {part.allowedExtensions?.join(', ')}
                                                </span>
                                              </div>
                                              {hasPart && (
                                                <Badge variant="secondary" className="text-xs">✓</Badge>
                                              )}
                                            </div>

                                            {isImage && (
                                              <div className="space-y-1">
                                                <Label htmlFor={`combo-file-${partIdx}`} className="text-xs">
                                                  Upload {part.assetType}
                                                </Label>
                                                <Input
                                                  id={`combo-file-${partIdx}`}
                                                  type="file"
                                                  accept={part.allowedExtensions?.join(',')}
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                      if (part.maxSize && file.size > part.maxSize) {
                                                        toast.error(`File size exceeds maximum of ${formatFileSize(part.maxSize)}`);
                                                        return;
                                                      }
                                                      setNewComboData(prev => ({
                                                        ...prev,
                                                        [asset.path]: {
                                                          ...prev[asset.path],
                                                          baseName: prev[asset.path]?.baseName || '',
                                                          parts: {
                                                            ...prev[asset.path]?.parts,
                                                            [partKey]: { content: '', file }
                                                          }
                                                        }
                                                      }));
                                                    }
                                                  }}
                                                  className="text-xs"
                                                />
                                                {hasPart && newComboData[asset.path]?.parts[partKey]?.file && (
                                                  <p className="text-xs text-muted-foreground">
                                                    Selected: {newComboData[asset.path].parts[partKey].file!.name}
                                                  </p>
                                                )}
                                              </div>
                                            )}

                                            {isJson && (
                                              <div className="space-y-2">
                                                {part.schema?.properties ? (
                                                  /* Schema-based form */
                                                  <div className="space-y-2">
                                                    <Label className="text-xs">JSON Content (Form)</Label>
                                                    {Object.entries(part.schema.properties).map(([fieldKey, fieldSchema]: [string, any]) => {
                                                      const comboPartData = newComboData[asset.path]?.parts[partKey];
                                                      const jsonData = comboPartData?.jsonData || {};
                                                      const value = jsonData[fieldKey] ?? fieldSchema.default ?? '';

                                                      const updateJsonField = (newValue: any) => {
                                                        setNewComboData(prev => ({
                                                          ...prev,
                                                          [asset.path]: {
                                                            ...prev[asset.path],
                                                            baseName: prev[asset.path]?.baseName || '',
                                                            parts: {
                                                              ...prev[asset.path]?.parts,
                                                              [partKey]: {
                                                                content: '',
                                                                jsonData: {
                                                                  ...(prev[asset.path]?.parts[partKey]?.jsonData || {}),
                                                                  [fieldKey]: newValue
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }));
                                                      };

                                                      return (
                                                        <div key={fieldKey} className="space-y-1">
                                                          <Label htmlFor={`combo-json-${partIdx}-${fieldKey}`} className="text-xs">
                                                            {fieldSchema.title || fieldKey}
                                                          </Label>
                                                          {fieldSchema.description && (
                                                            <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
                                                          )}
                                                          {fieldSchema.type === 'string' && fieldSchema.multiline ? (
                                                            <Textarea
                                                              id={`combo-json-${partIdx}-${fieldKey}`}
                                                              value={value}
                                                              onChange={(e) => updateJsonField(e.target.value)}
                                                              placeholder={fieldSchema.placeholder}
                                                              className="min-h-[60px] text-xs"
                                                            />
                                                          ) : fieldSchema.type === 'number' || fieldSchema.type === 'integer' ? (
                                                            <Input
                                                              id={`combo-json-${partIdx}-${fieldKey}`}
                                                              type="number"
                                                              value={value}
                                                              onChange={(e) => updateJsonField(fieldSchema.type === 'integer' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
                                                              placeholder={fieldSchema.placeholder}
                                                              className="h-8 text-xs"
                                                            />
                                                          ) : (
                                                            <Input
                                                              id={`combo-json-${partIdx}-${fieldKey}`}
                                                              value={value}
                                                              onChange={(e) => updateJsonField(e.target.value)}
                                                              placeholder={fieldSchema.placeholder}
                                                              className="h-8 text-xs"
                                                            />
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                ) : (
                                                  /* Fallback textarea */
                                                  <div className="space-y-1">
                                                    <Label htmlFor={`combo-json-${partIdx}`} className="text-xs">
                                                      JSON Content
                                                    </Label>
                                                    <Textarea
                                                      id={`combo-json-${partIdx}`}
                                                      value={newComboData[asset.path]?.parts[partKey]?.content || ''}
                                                      onChange={(e) => {
                                                        setNewComboData(prev => ({
                                                          ...prev,
                                                          [asset.path]: {
                                                            ...prev[asset.path],
                                                            baseName: prev[asset.path]?.baseName || '',
                                                            parts: {
                                                              ...prev[asset.path]?.parts,
                                                              [partKey]: { content: e.target.value }
                                                            }
                                                          }
                                                        }));
                                                      }}
                                                      placeholder='{"key": "value"}'
                                                      className="min-h-[60px] font-mono text-xs"
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {isText && (
                                              <div className="space-y-1">
                                                <Label htmlFor={`combo-text-${partIdx}`} className="text-xs">
                                                  Text Content
                                                </Label>
                                                <Textarea
                                                  id={`combo-text-${partIdx}`}
                                                  value={newComboData[asset.path]?.parts[partKey]?.content || ''}
                                                  onChange={(e) => {
                                                    setNewComboData(prev => ({
                                                      ...prev,
                                                      [asset.path]: {
                                                        ...prev[asset.path],
                                                        baseName: prev[asset.path]?.baseName || '',
                                                        parts: {
                                                          ...prev[asset.path]?.parts,
                                                          [partKey]: { content: e.target.value }
                                                        }
                                                      }
                                                    }));
                                                  }}
                                                  placeholder="Enter text content..."
                                                  className="min-h-[60px] text-xs"
                                                />
                                              </div>
                                            )}

                                            <p className="text-xs text-muted-foreground">
                                              Max: {formatFileSize(part.maxSize)}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                      onClick={() => submitNewCombo(asset)}
                                      className="w-full"
                                      size="sm"
                                    >
                                      Add to Batch
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Standard File Upload */
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
                            )}
                          </>
                        )}
                      </div>
                    )}

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

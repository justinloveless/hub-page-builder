import { useQueryClient } from "@tanstack/react-query";
import { useSiteAssets } from "@/hooks/useSiteAssets";
import { usePrefetchAssets } from "@/hooks/usePrefetchAssets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Folder, FileText, Image, AlertCircle, RefreshCw, GitPullRequest, ChevronDown, ChevronRight, Plus, Trash2, File, Users, Edit, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CreateShareDialog from "./CreateShareDialog";
import type { PendingAssetChange } from "@/pages/Manage";
import { useAssetManagerSidebar } from "./AssetManagerSidebar/useAssetManagerSidebar";
import { AssetManagerSidebarProvider } from "./AssetManagerSidebar/AssetManagerSidebarContext";
import { AssetManagerSidebarHeader } from "./AssetManagerSidebar/AssetManagerSidebarHeader";
import { AssetManagerSidebarNoConfig } from "./AssetManagerSidebar/AssetManagerSidebarNoConfig";
import { AssetTextEditor } from "./AssetManagerSidebar/AssetTextEditor";
import { AssetImageEditor } from "./AssetManagerSidebar/AssetImageEditor";
import { AssetJsonEditor } from "./AssetManagerSidebar/AssetJsonEditor";
import { DirectoryFileList } from "./AssetManagerSidebar/DirectoryFileList";
import { ComboAssetList } from "./AssetManagerSidebar/ComboAssetList";
import { ComboAssetCreator } from "./AssetManagerSidebar/ComboAssetCreator";
import { getAssetIcon, formatFileSize, isImageFile, getFileBaseName, getFileExtension, groupComboAssets, getFileAssetType } from "./AssetManagerSidebar/utils";

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
  
  const found = assetsData?.found ?? null;
  const config = assetsData?.config ?? null;

  // Prefetch all asset content in the background
  usePrefetchAssets(siteId, config?.assets);

  const {
    // State
    expandedAssets,
    assetContents,
    loadingContent,
    jsonFormData,
    newKeys,
    directoryFiles,
    loadingFiles,
    deletingFile,
    imageUrls,
    comboFileContents,
    loadingComboFile,
    creatingCombo,
    newComboData,
    draggedItem,
    dragOverItem,
    renamingFile,
    newFileName,
    draggedComboItem,
    dragOverComboItem,
    creatingPr,
    // Setters
    setNewKeys,
    setComboFileContents,
    setNewComboData,
    setRenamingFile,
    setNewFileName,
    setDraggedComboItem,
    setDragOverComboItem,
    // Handlers
    handleRefresh,
    toggleExpanded,
    handleContentChange,
    handleJsonFormChange,
    addNewEntry,
    removeEntry,
    handleFileUpload,
    getMergedDirectoryFiles,
    handleDeleteFile,
    handleRenameFile,
    handleDeleteComboAsset,
    handleRenameComboAsset,
    handleReorderDirectoryItems,
    handleAutoScroll,
    handleStopAutoScroll,
    handleReorderComboAssets,
    handleMoveComboAsset,
    handleMoveDirectoryItem,
    loadComboFileContent,
    handleComboFileContentChange,
    startCreatingCombo,
    cancelCreatingCombo,
    submitNewCombo,
    createTemplatePr,
  } = useAssetManagerSidebar({
    siteId,
    pendingChanges,
    setPendingChanges,
    queryClient,
    refetch,
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const contextValue = {
    // State
    expandedAssets,
    assetContents,
    loadingContent,
    jsonFormData,
    newKeys,
    directoryFiles,
    loadingFiles,
    deletingFile,
    imageUrls,
    comboFileContents,
    loadingComboFile,
    creatingCombo,
    newComboData,
    draggedItem,
    dragOverItem,
    renamingFile,
    newFileName,
    draggedComboItem,
    dragOverComboItem,
    creatingPr,
    // Setters
    setAssetContents,
    setNewKeys,
    setComboFileContents,
    setNewComboData,
    setRenamingFile,
    setNewFileName,
    setDraggedItem,
    setDragOverItem,
    setDraggedComboItem,
    setDragOverComboItem,
    // Handlers
    handleRefresh,
    toggleExpanded,
    handleContentChange,
    handleJsonFormChange,
    addNewEntry,
    removeEntry,
    handleFileUpload,
    getMergedDirectoryFiles,
    handleDeleteFile,
    handleRenameFile,
    handleDeleteComboAsset,
    handleRenameComboAsset,
    handleReorderDirectoryItems,
    handleAutoScroll,
    handleStopAutoScroll,
    handleReorderComboAssets,
    handleMoveComboAsset,
    handleMoveDirectoryItem,
    loadComboFileContent,
    handleComboFileContentChange,
    startCreatingCombo,
    cancelCreatingCombo,
    submitNewCombo,
    createTemplatePr,
  };

  if (found === false) {
    return (
      <AssetManagerSidebarProvider value={contextValue}>
        <AssetManagerSidebarNoConfig onCreatePr={createTemplatePr} creatingPr={creatingPr} />
      </AssetManagerSidebarProvider>
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
    <AssetManagerSidebarProvider value={contextValue}>
    <div className="space-y-3 w-full max-w-full">
      <AssetManagerSidebarHeader
        version={config.version}
        assetCount={config.assets.length}
        loading={loading}
        onRefresh={handleRefresh}
        assets={config.assets}
        siteId={siteId}
      />

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
                      <AssetJsonEditor
                        asset={asset}
                        jsonFormData={jsonFormData}
                        loading={loadingContent[asset.path] || false}
                        newKey={newKeys[asset.path] || ''}
                        onJsonFormChange={(jsonData) => handleJsonFormChange(asset, jsonData)}
                        onAddEntry={() => addNewEntry(asset)}
                        onRemoveEntry={(key) => removeEntry(asset, key)}
                        onNewKeyChange={(value) => setNewKeys(prev => ({ ...prev, [asset.path]: value }))}
                      />
                    )}

                    {/* Text/Markdown inline editor */}
                    {isTextAsset && (
                      <AssetTextEditor
                        asset={asset}
                      />
                    )}

                    {/* Image upload */}
                    {isImageAsset && (
                      <AssetImageEditor
                        asset={asset}
                        imageUrl={imageUrls[asset.path]}
                        loading={loadingContent[asset.path] || false}
                        index={index}
                        onFileUpload={(file) => handleFileUpload(asset, file)}
                      />
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
                              (() => {
                                const { groups, standalone } = groupComboAssets(getMergedDirectoryFiles(asset.path), asset.contains.parts!);
                                return (
                                  <ComboAssetList
                                    asset={asset}
                                    groups={groups}
                                    standalone={standalone}
                                  />
                                );
                              })()
                            ) : (
                              /* Standard Directory */
                              getMergedDirectoryFiles(asset.path).length > 0 && (
                                <DirectoryFileList
                                  asset={asset}
                                  files={getMergedDirectoryFiles(asset.path)}
                                />
                              )
                            )}

                            {/* Add New Assets */}
                            {asset.contains?.type === 'combo' && asset.contains.parts ? (
                              <ComboAssetCreator
                                asset={asset}
                              />
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
    </AssetManagerSidebarProvider>
  );
};

export default AssetManagerSidebar;

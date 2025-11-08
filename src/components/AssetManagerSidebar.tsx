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
import { AssetManagerSidebarHeader } from "./AssetManagerSidebar/AssetManagerSidebarHeader";
import { AssetManagerSidebarNoConfig } from "./AssetManagerSidebar/AssetManagerSidebarNoConfig";
import { AssetTextEditor } from "./AssetManagerSidebar/AssetTextEditor";
import { AssetImageEditor } from "./AssetManagerSidebar/AssetImageEditor";
import { AssetJsonEditor } from "./AssetManagerSidebar/AssetJsonEditor";
import { DirectoryFileList } from "./AssetManagerSidebar/DirectoryFileList";
import { getAssetIcon, formatFileSize, isImageFile, getFileBaseName, getFileExtension, groupComboAssets, getFileAssetType } from "./AssetManagerSidebar/utils";

import type { AssetConfig, AssetFile } from "./AssetManagerSidebar/types";

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

  if (found === false) {
    return <AssetManagerSidebarNoConfig onCreatePr={createTemplatePr} creatingPr={creatingPr} />;
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
                        content={assetContents[asset.path] || ''}
                        loading={loadingContent[asset.path] || false}
                        onContentChange={(content) => setAssetContents(prev => ({ ...prev, [asset.path]: content }))}
                        onBlur={(content) => handleContentChange(asset, content)}
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
                              <>
                                {(() => {
                                  const { groups, standalone } = groupComboAssets(getMergedDirectoryFiles(asset.path), asset.contains.parts);
                                  return (
                                    <>
                                      {groups.length > 0 && (
                                        <div className="space-y-3">
                                          {groups.map(([baseName, group], groupIndex) => {
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
                                              <div
                                                key={baseName}
                                                draggable
                                                onDragStart={() => setDraggedComboItem(groupIndex)}
                                                onDragOver={(e) => {
                                                  e.preventDefault();
                                                  handleAutoScroll(e);
                                                  setDragOverComboItem(groupIndex);
                                                }}
                                                onDrop={(e) => {
                                                  e.preventDefault();
                                                  handleStopAutoScroll();
                                                  if (draggedComboItem !== null && draggedComboItem !== groupIndex) {
                                                    handleReorderComboAssets(asset, groups, draggedComboItem, groupIndex);
                                                  }
                                                }}
                                                onDragEnd={() => {
                                                  handleStopAutoScroll();
                                                  setDraggedComboItem(null);
                                                  setDragOverComboItem(null);
                                                }}
                                                onDragLeave={() => {
                                                  handleStopAutoScroll();
                                                }}
                                                className={`p-3 border rounded-lg bg-accent/5 space-y-2 ${dragOverComboItem === groupIndex ? 'border-primary' : ''}`}
                                              >
                                                <div className="flex items-center gap-2">
                                                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleMoveComboAsset(asset, groups, groupIndex, 'up')}
                                                      disabled={groupIndex === 0}
                                                      className="h-4 w-4 p-0 hover:bg-muted"
                                                      title="Move up"
                                                    >
                                                      <ArrowUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleMoveComboAsset(asset, groups, groupIndex, 'down')}
                                                      disabled={groupIndex === groups.length - 1}
                                                      className="h-4 w-4 p-0 hover:bg-muted"
                                                      title="Move down"
                                                    >
                                                      <ArrowDown className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-move" />
                                                  <div className="flex items-center justify-between flex-1">
                                                    {renamingFile === baseName ? (
                                                      <div className="flex items-center gap-1 flex-1">
                                                        <Input
                                                          value={newFileName}
                                                          onChange={(e) => setNewFileName(e.target.value)}
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                              handleRenameComboAsset(asset, baseName, group.files, asset.contains.parts!);
                                                            } else if (e.key === 'Escape') {
                                                              setRenamingFile(null);
                                                              setNewFileName("");
                                                            }
                                                          }}
                                                          className="h-7 text-xs"
                                                          autoFocus
                                                        />
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={() => handleRenameComboAsset(asset, baseName, group.files, asset.contains.parts!)}
                                                          className="h-7 px-2 text-xs"
                                                        >
                                                          Save
                                                        </Button>
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={() => {
                                                            setRenamingFile(null);
                                                            setNewFileName("");
                                                          }}
                                                          className="h-7 px-2 text-xs"
                                                        >
                                                          Cancel
                                                        </Button>
                                                      </div>
                                                    ) : (
                                                      <>
                                                        <h5 className="text-xs font-semibold truncate">{baseName}</h5>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                              setRenamingFile(baseName);
                                                              setNewFileName(baseName);
                                                            }}
                                                            className="h-6"
                                                          >
                                                            <Edit className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteComboAsset(asset, baseName, group.files)}
                                                            className="h-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </Button>
                                                        </div>
                                                      </>
                                                    )}
                                                  </div>
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
                                                  {renamingFile === file.path ? (
                                                    <div className="flex items-center gap-1">
                                                      <Input
                                                        value={newFileName}
                                                        onChange={(e) => setNewFileName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                          if (e.key === 'Enter') {
                                                            handleRenameFile(asset, file);
                                                          } else if (e.key === 'Escape') {
                                                            setRenamingFile(null);
                                                            setNewFileName("");
                                                          }
                                                        }}
                                                        className="h-7 text-xs"
                                                        autoFocus
                                                      />
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRenameFile(asset, file)}
                                                        className="h-7 px-2 text-xs"
                                                      >
                                                        Save
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                          setRenamingFile(null);
                                                          setNewFileName("");
                                                        }}
                                                        className="h-7 px-2 text-xs"
                                                      >
                                                        Cancel
                                                      </Button>
                                                    </div>
                                                  ) : (
                                                    <>
                                                      <p className="text-xs font-medium truncate">{file.name}</p>
                                                      <p className="text-xs text-muted-foreground">
                                                        {(file.size / 1024).toFixed(1)} KB
                                                      </p>
                                                    </>
                                                  )}
                                                </div>
                                                {renamingFile !== file.path && (
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
                                                      onClick={() => {
                                                        setRenamingFile(file.path);
                                                        setNewFileName(file.name);
                                                      }}
                                                      className="h-7 w-7 p-0"
                                                      title="Rename file"
                                                    >
                                                      <Edit className="h-3 w-3" />
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
                                                )}
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
                                <DirectoryFileList
                                  asset={asset}
                                  files={getMergedDirectoryFiles(asset.path)}
                                  draggedItem={draggedItem}
                                  dragOverItem={dragOverItem}
                                  renamingFile={renamingFile}
                                  newFileName={newFileName}
                                  deletingFile={deletingFile}
                                  onDragStart={(index) => setDraggedItem(index)}
                                  onDragOver={(e, index) => {
                                    handleAutoScroll(e);
                                    setDragOverItem(index);
                                  }}
                                  onDrop={(e, index) => {
                                    handleStopAutoScroll();
                                    if (draggedItem !== null) {
                                      const files = getMergedDirectoryFiles(asset.path);
                                      const newOrder = [...Array(files.length).keys()];
                                      const [removed] = newOrder.splice(draggedItem, 1);
                                      newOrder.splice(index, 0, removed);
                                      handleReorderDirectoryItems(asset, files, newOrder);
                                    }
                                  }}
                                  onDragEnd={() => handleStopAutoScroll()}
                                  onDragLeave={() => handleStopAutoScroll()}
                                  onMoveUp={(index) => handleMoveDirectoryItem(asset, getMergedDirectoryFiles(asset.path), index, 'up')}
                                  onMoveDown={(index) => handleMoveDirectoryItem(asset, getMergedDirectoryFiles(asset.path), index, 'down')}
                                  onRename={(file) => handleRenameFile(asset, file)}
                                  onRenameCancel={() => {
                                    setRenamingFile(null);
                                    setNewFileName("");
                                  }}
                                  onRenameStart={(file) => {
                                    setRenamingFile(file.path);
                                    setNewFileName(file.name);
                                  }}
                                  onNewFileNameChange={(value) => setNewFileName(value)}
                                  onDelete={(file) => handleDeleteFile(asset, file.path, file.sha)}
                                  onOpenFile={(file) => window.open(file.download_url, '_blank')}
                                />
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

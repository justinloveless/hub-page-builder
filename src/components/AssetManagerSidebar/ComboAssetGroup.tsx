import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, GripVertical, Edit, Trash2 } from "lucide-react";
import type { AssetConfig, AssetFile } from "./types";
import { getFileAssetType, isImageFile, groupComboAssets } from "./utils";
import { useAssetManagerSidebarContext } from "./AssetManagerSidebarContext";

interface ComboAssetGroupProps {
  asset: AssetConfig;
  baseName: string;
  group: { files: AssetFile[]; types: string[] };
  groupIndex: number;
  totalGroups: number;
  sortedFiles: AssetFile[];
}

export const ComboAssetGroup = ({
  asset,
  baseName,
  group,
  groupIndex,
  totalGroups,
  sortedFiles,
}: ComboAssetGroupProps) => {
  const {
    comboFileContents,
    loadingComboFile,
    renamingFile,
    newFileName,
    draggedComboItem,
    dragOverComboItem,
    setRenamingFile,
    setNewFileName,
    setDraggedComboItem,
    setDragOverComboItem,
    setComboFileContents,
    handleFileUpload,
    handleComboFileContentChange,
    loadComboFileContent,
    handleDeleteComboAsset,
    handleRenameComboAsset,
    handleMoveComboAsset,
    getMergedDirectoryFiles,
    handleAutoScroll,
    handleStopAutoScroll,
    handleReorderComboAssets,
  } = useAssetManagerSidebarContext();
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
          const { groups } = groupComboAssets(getMergedDirectoryFiles(asset.path), asset.contains!.parts!);
          handleReorderComboAssets(asset, groups, draggedComboItem, groupIndex);
        }
        setDraggedComboItem(null);
        setDragOverComboItem(null);
      }}
      onDragEnd={() => {
        handleStopAutoScroll();
        setDraggedComboItem(null);
        setDragOverComboItem(null);
      }}
      onDragLeave={handleStopAutoScroll}
      className={`p-3 border rounded-lg bg-accent/5 space-y-2 ${dragOverComboItem === groupIndex ? 'border-primary' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const { groups } = groupComboAssets(getMergedDirectoryFiles(asset.path), asset.contains!.parts!);
              handleMoveComboAsset(asset, groups, groupIndex, 'up');
            }}
            disabled={groupIndex === 0}
            className="h-4 w-4 p-0 hover:bg-muted"
            title="Move up"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const { groups } = groupComboAssets(getMergedDirectoryFiles(asset.path), asset.contains!.parts!);
              handleMoveComboAsset(asset, groups, groupIndex, 'down');
            }}
            disabled={groupIndex === totalGroups - 1}
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
                    handleRenameComboAsset(asset, baseName, group.files, asset.contains!.parts!);
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
                onClick={() => handleRenameComboAsset(asset, baseName, group.files, asset.contains!.parts!)}
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
          const fileType = getFileAssetType(file.name, asset.contains!.parts!);
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
                          handleFileUpload(uploadAsset, newFile);
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
                    <div className="h-20 w-full bg-muted animate-pulse rounded" />
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
                    <div className="h-20 w-full bg-muted animate-pulse rounded" />
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
};

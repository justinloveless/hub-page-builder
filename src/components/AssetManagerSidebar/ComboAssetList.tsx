import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { File, FileText, Edit, Trash2, RefreshCw } from "lucide-react";
import type { AssetConfig, AssetFile } from "./types";
import { isImageFile, getFileAssetType } from "./utils";
import { ComboAssetGroup } from "./ComboAssetGroup";
import { useAssetManagerSidebarContext } from "./AssetManagerSidebarContext";

interface ComboAssetListProps {
  asset: AssetConfig;
  groups: [string, { files: AssetFile[]; types: string[] }][];
  standalone: AssetFile[];
  comboParts: Array<{ assetType: string; allowedExtensions?: string[]; maxSize?: number; schema?: Record<string, any> }>;
}

export const ComboAssetList = ({
  asset,
  groups,
  standalone,
  comboParts,
}: ComboAssetListProps) => {
  const {
    comboFileContents,
    loadingComboFile,
    renamingFile,
    newFileName,
    deletingFile,
    draggedComboItem,
    dragOverComboItem,
    setDraggedComboItem,
    setDragOverComboItem,
    setRenamingFile,
    setNewFileName,
    handleAutoScroll,
    handleStopAutoScroll,
    handleDeleteFile,
    handleRenameFile,
    handleDeleteComboAsset,
    handleRenameComboAsset,
    handleReorderComboAssets,
    handleMoveComboAsset,
    getMergedDirectoryFiles,
  } = useAssetManagerSidebarContext();
  return (
    <>
      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map(([baseName, group], groupIndex) => {
            // Sort files by type: images first, then text, then json
            const sortedFiles = [...group.files].sort((a, b) => {
              const aType = getFileAssetType(a.name, comboParts);
              const bType = getFileAssetType(b.name, comboParts);
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
              <ComboAssetGroup
                key={baseName}
                asset={asset}
                baseName={baseName}
                group={group}
                groupIndex={groupIndex}
                totalGroups={groups.length}
                sortedFiles={sortedFiles}
                comboParts={comboParts}
              />
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
};

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { File, FileText, Edit, Trash2, RefreshCw } from "lucide-react";
import type { AssetConfig, AssetFile } from "./types";
import { isImageFile } from "./utils";
import { ComboAssetGroup } from "./ComboAssetGroup";

interface ComboAssetListProps {
  asset: AssetConfig;
  groups: [string, { files: AssetFile[]; types: string[] }][];
  standalone: AssetFile[];
  comboFileContents: Record<string, string>;
  loadingComboFile: Record<string, boolean>;
  renamingFile: string | null;
  newFileName: string;
  deletingFile: string | null;
  draggedComboItem: number | null;
  dragOverComboItem: number | null;
  onDragStart: (groupIndex: number) => void;
  onDragOver: (e: React.DragEvent, groupIndex: number) => void;
  onDrop: (e: React.DragEvent, groupIndex: number) => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  onMoveComboAsset: (groupIndex: number, direction: 'up' | 'down') => void;
  onRenameComboStart: (baseName: string) => void;
  onRenameComboSave: (baseName: string, files: AssetFile[]) => void;
  onRenameComboCancel: () => void;
  onNewFileNameChange: (value: string) => void;
  onDeleteComboAsset: (baseName: string, files: AssetFile[]) => void;
  onRenameFileStart: (file: AssetFile) => void;
  onRenameFileSave: (file: AssetFile) => void;
  onRenameFileCancel: () => void;
  onDeleteFile: (file: AssetFile) => void;
  onOpenFile: (file: AssetFile) => void;
  onFileContentChange: (filePath: string, content: string) => void;
  onComboFileContentChange: (filePath: string, content: string) => void;
  onSetComboFileContent: (filePath: string, content: string) => void;
  onFileUpload: (filePath: string, file: File) => void;
  onLoadComboFileContent: (filePath: string) => void;
  getFileAssetType: (fileName: string) => string | undefined;
}

export const ComboAssetList = ({
  asset,
  groups,
  standalone,
  comboFileContents,
  loadingComboFile,
  renamingFile,
  newFileName,
  deletingFile,
  draggedComboItem,
  dragOverComboItem,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragLeave,
  onMoveComboAsset,
  onRenameComboStart,
  onRenameComboSave,
  onRenameComboCancel,
  onNewFileNameChange,
  onDeleteComboAsset,
  onRenameFileStart,
  onRenameFileSave,
  onRenameFileCancel,
  onDeleteFile,
  onOpenFile,
  onFileContentChange,
  onComboFileContentChange,
  onSetComboFileContent,
  onFileUpload,
  onLoadComboFileContent,
  getFileAssetType,
}: ComboAssetListProps) => {
  return (
    <>
      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map(([baseName, group], groupIndex) => {
            // Sort files by type: images first, then text, then json
            const sortedFiles = [...group.files].sort((a, b) => {
              const aType = getFileAssetType(a.name);
              const bType = getFileAssetType(b.name);
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
                comboFileContents={comboFileContents}
                loadingComboFile={loadingComboFile}
                renamingFile={renamingFile}
                newFileName={newFileName}
                draggedComboItem={draggedComboItem}
                dragOverComboItem={dragOverComboItem}
                onDragStart={() => onDragStart(groupIndex)}
                onDragOver={(e) => onDragOver(e, groupIndex)}
                onDrop={(e) => onDrop(e, groupIndex)}
                onDragEnd={onDragEnd}
                onDragLeave={onDragLeave}
                onMoveUp={() => onMoveComboAsset(groupIndex, 'up')}
                onMoveDown={() => onMoveComboAsset(groupIndex, 'down')}
                onRenameStart={() => onRenameComboStart(baseName)}
                onRenameSave={() => onRenameComboSave(baseName, group.files)}
                onRenameCancel={onRenameComboCancel}
                onNewFileNameChange={onNewFileNameChange}
                onDelete={() => onDeleteComboAsset(baseName, group.files)}
                onFileContentChange={onFileContentChange}
                onComboFileContentChange={onComboFileContentChange}
                onSetComboFileContent={onSetComboFileContent}
                onFileUpload={onFileUpload}
                onLoadComboFileContent={onLoadComboFileContent}
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
                        onChange={(e) => onNewFileNameChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onRenameFileSave(file);
                          } else if (e.key === 'Escape') {
                            onRenameFileCancel();
                          }
                        }}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRenameFileSave(file)}
                        className="h-7 px-2 text-xs"
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRenameFileCancel}
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
                      onClick={() => onOpenFile(file)}
                      className="h-7 w-7 p-0"
                      title="Open file"
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRenameFileStart(file)}
                      className="h-7 w-7 p-0"
                      title="Rename file"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteFile(file)}
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, GripVertical, Edit } from "lucide-react";
import type { AssetConfig, AssetFile } from "./types";
import { getFileAssetType, isImageFile } from "./utils";

interface ComboAssetGroupProps {
  asset: AssetConfig;
  baseName: string;
  group: { files: AssetFile[]; types: string[] };
  groupIndex: number;
  totalGroups: number;
  sortedFiles: AssetFile[];
  comboFileContents: Record<string, string>;
  loadingComboFile: Record<string, boolean>;
  renamingFile: string | null;
  newFileName: string;
  draggedComboItem: number | null;
  dragOverComboItem: number | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRenameStart: () => void;
  onRenameSave: () => void;
  onRenameCancel: () => void;
  onNewFileNameChange: (value: string) => void;
  onDelete: () => void;
  onFileContentChange: (filePath: string, content: string) => void;
  onComboFileContentChange: (filePath: string, content: string) => void;
  onSetComboFileContent: (filePath: string, content: string) => void;
  onFileUpload: (filePath: string, file: File) => void;
  onLoadComboFileContent: (filePath: string) => void;
}

export const ComboAssetGroup = ({
  asset,
  baseName,
  group,
  groupIndex,
  totalGroups,
  sortedFiles,
  comboFileContents,
  loadingComboFile,
  renamingFile,
  newFileName,
  draggedComboItem,
  dragOverComboItem,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDragLeave,
  onMoveUp,
  onMoveDown,
  onRenameStart,
  onRenameSave,
  onRenameCancel,
  onNewFileNameChange,
  onDelete,
  onFileContentChange,
  onComboFileContentChange,
  onSetComboFileContent,
  onFileUpload,
  onLoadComboFileContent,
}: ComboAssetGroupProps) => {
  return (
    <div
      key={baseName}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDragLeave={onDragLeave}
      className={`p-3 border rounded-lg bg-accent/5 space-y-2 ${dragOverComboItem === groupIndex ? 'border-primary' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
            disabled={groupIndex === 0}
            className="h-4 w-4 p-0 hover:bg-muted"
            title="Move up"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
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
                onChange={(e) => onNewFileNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onRenameSave();
                  } else if (e.key === 'Escape') {
                    onRenameCancel();
                  }
                }}
                className="h-7 text-xs"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={onRenameSave}
                className="h-7 px-2 text-xs"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRenameCancel}
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
                  onClick={onRenameStart}
                  className="h-6"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
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
            onLoadComboFileContent(file.path);
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
                          onFileUpload(file.path, newFile);
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
                        onChange={(e) => onSetComboFileContent(file.path, e.target.value)}
                        onBlur={(e) => onComboFileContentChange(file.path, e.target.value)}
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
                                      onComboFileContentChange(file.path, JSON.stringify(updated, null, 2));
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
                              onChange={(e) => onSetComboFileContent(file.path, e.target.value)}
                              onBlur={(e) => onComboFileContentChange(file.path, e.target.value)}
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

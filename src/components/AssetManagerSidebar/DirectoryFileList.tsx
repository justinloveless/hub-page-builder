import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, GripVertical, File, FileText, Edit, Trash2, RefreshCw } from "lucide-react";
import { isImageFile } from "./utils";
import type { AssetConfig, AssetFile } from "./types";
import { useAssetManagerSidebarContext } from "./AssetManagerSidebarContext";

interface DirectoryFileListProps {
  asset: AssetConfig;
  files: AssetFile[];
}

export const DirectoryFileList = ({
  asset,
  files,
}: DirectoryFileListProps) => {
  const {
    draggedItem,
    dragOverItem,
    renamingFile,
    newFileName,
    deletingFile,
    setDraggedItem,
    setDragOverItem,
    setRenamingFile,
    setNewFileName,
    handleAutoScroll,
    handleStopAutoScroll,
    handleDeleteFile,
    handleRenameFile,
    handleMoveDirectoryItem,
    handleReorderDirectoryItems,
    getMergedDirectoryFiles,
  } = useAssetManagerSidebarContext();
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Existing Files</Label>
      <div className="space-y-1">
        {files.map((file, fileIndex) => (
          <div
            key={file.path}
            draggable
            onDragStart={() => setDraggedItem(fileIndex)}
            onDragOver={(e) => {
              e.preventDefault();
              handleAutoScroll(e);
              setDragOverItem(fileIndex);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleStopAutoScroll();
              if (draggedItem !== null) {
                const filesInDir = getMergedDirectoryFiles(asset.path);
                const newOrder = [...Array(filesInDir.length).keys()];
                const [removed] = newOrder.splice(draggedItem, 1);
                newOrder.splice(fileIndex, 0, removed);
                handleReorderDirectoryItems(asset, filesInDir, newOrder);
              }
              setDraggedItem(null);
              setDragOverItem(null);
            }}
            onDragEnd={() => {
              handleStopAutoScroll();
              setDraggedItem(null);
              setDragOverItem(null);
            }}
            onDragLeave={handleStopAutoScroll}
            className={`flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50 w-full max-w-full ${dragOverItem === fileIndex ? 'border-primary' : ''}`}
          >
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveDirectoryItem(asset, getMergedDirectoryFiles(asset.path), fileIndex, 'up')}
                disabled={fileIndex === 0}
                className="h-4 w-4 p-0 hover:bg-muted"
                title="Move up"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveDirectoryItem(asset, getMergedDirectoryFiles(asset.path), fileIndex, 'down')}
                disabled={fileIndex === files.length - 1}
                className="h-4 w-4 p-0 hover:bg-muted"
                title="Move down"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
            <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0 cursor-move" />
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
  );
};

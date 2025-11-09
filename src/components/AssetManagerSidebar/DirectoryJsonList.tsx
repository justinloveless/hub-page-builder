import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, GripVertical, Edit, Trash2, RefreshCw } from "lucide-react";
import type { AssetConfig, AssetFile } from "./types";
import { useAssetManagerSidebarContext } from "./AssetManagerSidebarContext";
import { SchemaFieldRenderer } from "./SchemaFieldRenderer";

interface DirectoryJsonListProps {
    asset: AssetConfig;
    files: AssetFile[];
    schema?: Record<string, any>;
}

export const DirectoryJsonList = ({
    asset,
    files,
    schema,
}: DirectoryJsonListProps) => {
    const {
        comboFileContents,
        loadingComboFile,
        draggedItem,
        dragOverItem,
        renamingFile,
        newFileName,
        deletingFile,
        jsonFormData,
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
        handleJsonFormChange,
        getMergedDirectoryFiles,
        loadComboFileContent,
        setJsonFormData,
    } = useAssetManagerSidebarContext();

    if (files.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            <Label className="text-xs">JSON Files</Label>
            <div className="space-y-2">
                {files.map((file, fileIndex) => {
                    // Auto-load content for JSON files
                    if (!comboFileContents[file.path] && !loadingComboFile[file.path]) {
                        loadComboFileContent(file.path);
                    }

                    // Parse JSON content and store in jsonFormData when loaded
                    if (comboFileContents[file.path] && !jsonFormData[file.path]) {
                        try {
                            const parsed = JSON.parse(comboFileContents[file.path]);
                            setJsonFormData(prev => ({ ...prev, [file.path]: parsed }));
                        } catch (e) {
                            console.error("Failed to parse JSON:", e);
                        }
                    }

                    return (
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
                            className={`p-3 border rounded-lg bg-accent/5 space-y-2 ${dragOverItem === fileIndex ? 'border-primary' : ''}`}
                        >
                            {/* Header with controls */}
                            <div className="flex items-center gap-2">
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
                                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-move" />
                                <div className="flex items-center justify-between flex-1">
                                    {renamingFile === file.path ? (
                                        <div className="flex items-center gap-1 flex-1">
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
                                            <h5 className="text-xs font-semibold truncate">{file.name}</h5>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setRenamingFile(file.path);
                                                        setNewFileName(file.name);
                                                    }}
                                                    className="h-6"
                                                >
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteFile(asset, file.path, file.sha)}
                                                    disabled={deletingFile === file.path}
                                                    className="h-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    {deletingFile === file.path ? (
                                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3 w-3" />
                                                    )}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* JSON Content with Schema */}
                            <div className="border rounded bg-background p-2 space-y-2">
                                {loadingComboFile[file.path] && (
                                    <div className="h-20 w-full bg-muted animate-pulse rounded" />
                                )}

                                {comboFileContents[file.path] && schema && (
                                    <>
                                        {schema.properties && (
                                            <div className="space-y-2">
                                                {Object.entries(schema.properties).map(([key, fieldSchema]: [string, any]) => (
                                                    <SchemaFieldRenderer
                                                        key={key}
                                                        asset={{ ...asset, path: file.path }}
                                                        fieldKey={key}
                                                        fieldSchema={fieldSchema}
                                                        jsonFormData={jsonFormData}
                                                        onJsonFormChange={(modifiedAsset, jsonData) => {
                                                            // Use the file path for the modified asset
                                                            handleJsonFormChange({ ...asset, path: file.path }, jsonData);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">Changes are automatically saved to batch</p>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


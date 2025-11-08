import { createContext, useContext } from 'react';
import type { AssetConfig, AssetFile } from './types';

interface AssetManagerSidebarContextValue {
  // State
  expandedAssets: Set<string>;
  assetContents: Record<string, string>;
  loadingContent: Record<string, boolean>;
  jsonFormData: Record<string, Record<string, any>>;
  newKeys: Record<string, string>;
  directoryFiles: Record<string, AssetFile[]>;
  loadingFiles: Record<string, boolean>;
  deletingFile: string | null;
  imageUrls: Record<string, string>;
  comboFileContents: Record<string, string>;
  loadingComboFile: Record<string, boolean>;
  creatingCombo: Record<string, boolean>;
  newComboData: Record<string, { baseName: string; parts: Record<string, { content: string; file?: File; jsonData?: Record<string, any> }> }>;
  draggedItem: number | null;
  dragOverItem: number | null;
  renamingFile: string | null;
  newFileName: string;
  draggedComboItem: number | null;
  dragOverComboItem: number | null;
  creatingPr: boolean;

  // Setters
  setAssetContents: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setJsonFormData: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
  setNewKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setComboFileContents: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setNewComboData: React.Dispatch<React.SetStateAction<Record<string, { baseName: string; parts: Record<string, { content: string; file?: File; jsonData?: Record<string, any> }> }>>>;
  setRenamingFile: React.Dispatch<React.SetStateAction<string | null>>;
  setNewFileName: React.Dispatch<React.SetStateAction<string>>;
  setDraggedItem: React.Dispatch<React.SetStateAction<number | null>>;
  setDragOverItem: React.Dispatch<React.SetStateAction<number | null>>;
  setDraggedComboItem: React.Dispatch<React.SetStateAction<number | null>>;
  setDragOverComboItem: React.Dispatch<React.SetStateAction<number | null>>;

  // Handlers
  handleRefresh: () => void;
  toggleExpanded: (asset: AssetConfig) => void;
  handleContentChange: (asset: AssetConfig, content: string) => void;
  handleJsonFormChange: (asset: AssetConfig, jsonData: Record<string, any>) => void;
  addNewEntry: (asset: AssetConfig) => void;
  removeEntry: (asset: AssetConfig, key: string) => void;
  handleFileUpload: (asset: AssetConfig, file: File) => void;
  getMergedDirectoryFiles: (path: string) => AssetFile[];
  handleDeleteFile: (asset: AssetConfig, path: string, sha: string) => void;
  handleRenameFile: (asset: AssetConfig, file: AssetFile) => void;
  handleDeleteComboAsset: (asset: AssetConfig, baseName: string, files: AssetFile[]) => void;
  handleRenameComboAsset: (asset: AssetConfig, baseName: string, files: AssetFile[], parts: any[]) => void;
  handleReorderDirectoryItems: (asset: AssetConfig, files: AssetFile[], newOrder: number[]) => void;
  handleAutoScroll: (e: React.DragEvent) => void;
  handleStopAutoScroll: () => void;
  handleReorderComboAssets: (asset: AssetConfig, groups: [string, { files: AssetFile[]; types: string[] }][], draggedIndex: number, targetIndex: number) => void;
  handleMoveComboAsset: (asset: AssetConfig, groups: [string, { files: AssetFile[]; types: string[] }][], groupIndex: number, direction: 'up' | 'down') => void;
  handleMoveDirectoryItem: (asset: AssetConfig, files: AssetFile[], index: number, direction: 'up' | 'down') => void;
  loadComboFileContent: (filePath: string) => void;
  handleComboFileContentChange: (filePath: string, content: string) => void;
  startCreatingCombo: (asset: AssetConfig) => void;
  cancelCreatingCombo: (path: string) => void;
  submitNewCombo: (asset: AssetConfig) => void;
  createTemplatePr: () => void;
}

const AssetManagerSidebarContext = createContext<AssetManagerSidebarContextValue | undefined>(undefined);

export const AssetManagerSidebarProvider = AssetManagerSidebarContext.Provider;

export const useAssetManagerSidebarContext = () => {
  const context = useContext(AssetManagerSidebarContext);
  if (!context) {
    throw new Error('useAssetManagerSidebarContext must be used within AssetManagerSidebarProvider');
  }
  return context;
};

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PendingAssetChange } from "@/pages/Manage";

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

interface UseAssetManagerSidebarProps {
  siteId: string;
  pendingChanges: PendingAssetChange[];
  setPendingChanges: (changes: PendingAssetChange[]) => void;
  queryClient: ReturnType<typeof useQueryClient>;
  refetch: () => Promise<any>;
}

export const useAssetManagerSidebar = ({
  siteId,
  pendingChanges,
  setPendingChanges,
  queryClient,
  refetch,
}: UseAssetManagerSidebarProps) => {
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
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState<string>("");
  const [draggedComboItem, setDraggedComboItem] = useState<number | null>(null);
  const [dragOverComboItem, setDragOverComboItem] = useState<number | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // All handler functions will be moved here
  // For now, return state and setters
  return {
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
    editingComboImage,
    renamingFile,
    newFileName,
    draggedComboItem,
    dragOverComboItem,
    scrollIntervalRef,
    // Setters
    setExpandedAssets,
    setAssetContents,
    setLoadingContent,
    setJsonFormData,
    setNewKeys,
    setDirectoryFiles,
    setLoadingFiles,
    setDeletingFile,
    setImageUrls,
    setComboFileContents,
    setLoadingComboFile,
    setCreatingCombo,
    setNewComboData,
    setDraggedItem,
    setDragOverItem,
    setEditingComboImage,
    setRenamingFile,
    setNewFileName,
    setDraggedComboItem,
    setDragOverComboItem,
  };
};

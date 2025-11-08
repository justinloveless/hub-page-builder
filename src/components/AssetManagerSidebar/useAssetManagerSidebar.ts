import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PendingAssetChange } from "@/pages/Manage";
import type { AssetConfig, AssetFile } from "./types";
import { getFileBaseName, getFileExtension, isImageFile } from "./utils";

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
  const [creatingPr, setCreatingPr] = useState(false);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleRefresh = async () => {
    await refetch();
  };

  const loadImageAsset = async (asset: AssetConfig) => {
    setLoadingContent(prev => ({ ...prev, [asset.path]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: asset.path },
      });

      if (error) throw error;

      if (data.found && data.download_url) {
        setImageUrls(prev => ({ ...prev, [asset.path]: data.download_url }));
      }
    } catch (error: any) {
      console.error("Failed to load image:", error);
      toast.error("Failed to load image");
    } finally {
      setLoadingContent(prev => ({ ...prev, [asset.path]: false }));
    }
  };

  const loadDirectoryFiles = async (asset: AssetConfig) => {
    setLoadingFiles(prev => ({ ...prev, [asset.path]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('list-directory-assets', {
        body: { site_id: siteId, asset_path: asset.path },
      });

      if (error) throw error;

      let files = data.files || [];
      const basePath = asset.path.endsWith('/') ? asset.path : asset.path + '/';
      const manifestPath = basePath + 'manifest.json';

      try {
        let manifestContent: string | null = null;
        const pendingManifest = pendingChanges.find(c => c.repoPath === manifestPath);
        if (pendingManifest) {
          manifestContent = atob(pendingManifest.content);
        } else {
          const { data: manifestData } = await supabase.functions.invoke('fetch-asset-content', {
            body: { site_id: siteId, asset_path: manifestPath },
          });
          if (manifestData?.found) {
            manifestContent = manifestData.content;
          }
        }

        if (manifestContent) {
          const manifest = JSON.parse(manifestContent);
          if (manifest.files && Array.isArray(manifest.files)) {
            const orderedFiles: AssetFile[] = [];
            const fileMap = new Map<string, AssetFile>(files.map(f => [f.name, f]));
            manifest.files.forEach((fileName: string) => {
              const file = fileMap.get(fileName);
              if (file) {
                orderedFiles.push(file);
                fileMap.delete(fileName);
              }
            });
            fileMap.forEach((file) => orderedFiles.push(file));
            files = orderedFiles;
          }
        }
      } catch (manifestError) {
        console.debug('No manifest.json found or failed to parse:', manifestError);
      }

      setDirectoryFiles(prev => ({ ...prev, [asset.path]: files }));
    } catch (error: any) {
      console.error('Error loading directory files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoadingFiles(prev => ({ ...prev, [asset.path]: false }));
    }
  };

  const loadAssetContent = async (asset: AssetConfig) => {
    setLoadingContent(prev => ({ ...prev, [asset.path]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: asset.path },
      });

      if (error) throw error;

      if (data.found) {
        setAssetContents(prev => ({ ...prev, [asset.path]: data.content }));

        if (asset.type === 'json' && asset.schema) {
          try {
            const parsed = JSON.parse(data.content);
            setJsonFormData(prev => ({ ...prev, [asset.path]: parsed }));
          } catch (e) {
            console.error("Failed to parse JSON:", e);
            setJsonFormData(prev => ({ ...prev, [asset.path]: {} }));
          }
        }
      }
    } catch (error: any) {
      console.error("Failed to load content:", error);
    } finally {
      setLoadingContent(prev => ({ ...prev, [asset.path]: false }));
    }
  };

  const toggleExpanded = async (asset: AssetConfig) => {
    const newExpanded = new Set(expandedAssets);
    if (newExpanded.has(asset.path)) {
      newExpanded.delete(asset.path);
    } else {
      newExpanded.add(asset.path);

      const cachedContent = queryClient.getQueryData(['asset-content', siteId, asset.path]);
      const cachedFiles = queryClient.getQueryData(['directory-files', siteId, asset.path]);

      if ((asset.type === 'text' || asset.type === 'json' || asset.type === 'markdown') && !assetContents[asset.path] && !cachedContent) {
        await loadAssetContent(asset);
      } else if (cachedContent && !assetContents[asset.path]) {
        const data = cachedContent as any;
        if (data.found) {
          setAssetContents(prev => ({ ...prev, [asset.path]: data.content }));
          if (asset.type === 'json' && asset.schema) {
            try {
              const parsed = JSON.parse(data.content);
              setJsonFormData(prev => ({ ...prev, [asset.path]: parsed }));
            } catch (e) {
              console.error("Failed to parse JSON:", e);
            }
          }
        }
      }

      if ((asset.type === 'directory' || asset.type === 'folder') && !directoryFiles[asset.path] && !cachedFiles) {
        await loadDirectoryFiles(asset);
      } else if (cachedFiles && !directoryFiles[asset.path]) {
        setDirectoryFiles(prev => ({ ...prev, [asset.path]: cachedFiles as any }));
      }

      if ((asset.type === 'image' || asset.type === 'img') && !imageUrls[asset.path]) {
        const cachedImage = queryClient.getQueryData(['asset-content', siteId, asset.path]);
        if (cachedImage) {
          const data = cachedImage as any;
          if (data.found && data.download_url) {
            setImageUrls(prev => ({ ...prev, [asset.path]: data.download_url }));
          }
        } else {
          await loadImageAsset(asset);
        }
      }
    }
    setExpandedAssets(newExpanded);
  };

  const saveToBatch = async (asset: AssetConfig, content: string) => {
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const fileName = asset.path.split('/').pop() || 'file';

    let originalContent = "";
    try {
      const { data: originalData } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: asset.path },
      });
      if (originalData?.found) {
        originalContent = originalData.content;
      }
    } catch (error) {
      console.error("Failed to fetch original content:", error);
    }

    const newChange: PendingAssetChange = {
      repoPath: asset.path,
      content: base64Content,
      originalContent: originalContent ? btoa(unescape(encodeURIComponent(originalContent))) : undefined,
      fileName
    };

    const updatedChanges = pendingChanges.filter(c => c.repoPath !== asset.path);
    setPendingChanges([...updatedChanges, newChange]);
  };

  const handleContentChange = async (asset: AssetConfig, newContent: string) => {
    setAssetContents(prev => ({ ...prev, [asset.path]: newContent }));
    await saveToBatch(asset, newContent);
  };

  const handleJsonFormChange = async (asset: AssetConfig, jsonData?: Record<string, any>) => {
    const dataToUse = jsonData ?? jsonFormData[asset.path];
    const newContent = JSON.stringify(dataToUse, null, 2);
    setAssetContents(prev => ({ ...prev, [asset.path]: newContent }));
    await saveToBatch(asset, newContent);
  };

  const addNewEntry = async (asset: AssetConfig) => {
    const newKey = newKeys[asset.path] || '';
    if (!newKey.trim()) {
      toast.error("Key cannot be empty");
      return;
    }
    const currentData = jsonFormData[asset.path] || {};
    if (currentData[newKey]) {
      toast.error("Key already exists");
      return;
    }

    const additionalPropsSchema = asset.schema?.additionalProperties;
    let defaultValue = {};

    if (additionalPropsSchema?.type === 'object' && additionalPropsSchema.properties) {
      Object.entries(additionalPropsSchema.properties).forEach(([propKey, propSchema]: [string, any]) => {
        defaultValue[propKey] = propSchema.default ?? '';
      });
    }

    const updatedData = { ...currentData, [newKey]: defaultValue };
    setJsonFormData(prev => ({
      ...prev,
      [asset.path]: updatedData
    }));
    setNewKeys(prev => ({ ...prev, [asset.path]: '' }));
    toast.success(`Added "${newKey}"`);
    await handleJsonFormChange(asset, updatedData);
  };

  const removeEntry = async (asset: AssetConfig, key: string) => {
    const currentData = jsonFormData[asset.path] || {};
    const updated = { ...currentData };
    delete updated[key];
    setJsonFormData(prev => ({
      ...prev,
      [asset.path]: updated
    }));
    toast.success(`Removed "${key}"`);
    await handleJsonFormChange(asset, updated);
  };

  const handleFileUpload = async (asset: AssetConfig, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];

      let fullPath = asset.path;
      if (asset.type === 'directory' || asset.path.endsWith('/')) {
        const basePath = asset.path.endsWith('/') ? asset.path : asset.path + '/';
        fullPath = basePath + file.name;
      }

      const newChange: PendingAssetChange = {
        repoPath: fullPath,
        content: base64,
        fileName: file.name
      };

      const updatedChanges = pendingChanges.filter(c => c.repoPath !== fullPath);
      setPendingChanges([...updatedChanges, newChange]);
      toast.success("Added to batch");
    };
    reader.readAsDataURL(file);
  };

  const getMergedDirectoryFiles = (assetPath: string): AssetFile[] => {
    const committedFiles = directoryFiles[assetPath] || [];
    const basePath = assetPath.endsWith('/') ? assetPath : assetPath + '/';

    const pendingFiles = pendingChanges
      .filter(change => change.repoPath.startsWith(basePath))
      .map(change => {
        const ext = change.fileName.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
        const mimeType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` :
          ext === 'json' ? 'application/json' : 'text/plain';

        return {
          name: change.fileName,
          path: change.repoPath,
          sha: 'pending',
          size: Math.floor(change.content.length * 0.75),
          type: 'file',
          download_url: `data:${mimeType};base64,${change.content}`
        };
      });

    const fileMap = new Map<string, AssetFile>();
    committedFiles.forEach(file => fileMap.set(file.path, file));
    pendingFiles.forEach(file => fileMap.set(file.path, file));

    let files = Array.from(fileMap.values());

    const manifestPath = basePath + 'manifest.json';
    const pendingManifest = pendingChanges.find(c => c.repoPath === manifestPath);

    if (pendingManifest) {
      try {
        const manifestContent = atob(pendingManifest.content);
        const manifest = JSON.parse(manifestContent);

        if (manifest.files && Array.isArray(manifest.files)) {
          const orderedFiles: AssetFile[] = [];
          const fileByName = new Map<string, AssetFile>(files.map(f => [f.name, f]));

          manifest.files.forEach((fileName: string) => {
            const file = fileByName.get(fileName);
            if (file) {
              orderedFiles.push(file);
              fileByName.delete(fileName);
            }
          });

          fileByName.forEach(file => orderedFiles.push(file));
          files = orderedFiles;
        }
      } catch (error) {
        console.debug('Failed to parse pending manifest:', error);
      }
    }

    return files;
  };

  const handleDeleteFile = async (asset: AssetConfig, filePath: string, sha: string) => {
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;

    setDeletingFile(filePath);
    try {
      const { error } = await supabase.functions.invoke('delete-site-asset', {
        body: {
          site_id: siteId,
          file_path: filePath,
          sha: sha,
          message: `Delete ${filePath}`,
        },
      });

      if (error) throw error;

      toast.success("File deleted successfully");
      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error(error.message || "Failed to delete file");
    } finally {
      setDeletingFile(null);
    }
  };

  const handleRenameFile = async (asset: AssetConfig, file: AssetFile) => {
    if (!newFileName.trim()) {
      toast.error("Filename cannot be empty");
      return;
    }

    if (newFileName === file.name) {
      setRenamingFile(null);
      setNewFileName("");
      return;
    }

    try {
      const dirPath = asset.path.endsWith('/') ? asset.path : asset.path + '/';
      const newFilePath = dirPath + newFileName;
      const existingPending = pendingChanges.find(c => c.repoPath === file.path);

      let fileContent: string;

      if (existingPending) {
        fileContent = existingPending.content;
      } else {
        const isImage = isImageFile(file.name);

        if (isImage) {
          const response = await fetch(file.download_url);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          fileContent = base64;
        } else {
          const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
            body: { site_id: siteId, asset_path: file.path },
          });

          if (error) throw error;

          if (!data.found) {
            toast.error("File not found");
            return;
          }

          fileContent = btoa(unescape(encodeURIComponent(data.content)));
        }
      }

      const newChange: PendingAssetChange = {
        repoPath: newFilePath,
        content: fileContent,
        fileName: newFileName
      };

      let updatedChanges = pendingChanges.filter(c => c.repoPath !== file.path);
      updatedChanges = [...updatedChanges, newChange];

      setPendingChanges(updatedChanges);
      setRenamingFile(null);
      setNewFileName("");
      toast.success(`Renamed to ${newFileName}`);

      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error('Error renaming file:', error);
      toast.error(error.message || "Failed to rename file");
    }
  };

  const handleDeleteComboAsset = async (asset: AssetConfig, baseName: string, files: AssetFile[]) => {
    if (!confirm(`Are you sure you want to delete all parts of "${baseName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      for (const file of files) {
        const { error } = await supabase.functions.invoke('delete-site-asset', {
          body: {
            site_id: siteId,
            file_path: file.path,
            sha: file.sha,
            message: `Delete ${file.path}`,
          },
        });
        if (error) throw error;
      }

      toast.success(`Deleted combo asset "${baseName}"`);
      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error('Error deleting combo asset:', error);
      toast.error(error.message || "Failed to delete combo asset");
    }
  };

  const handleRenameComboAsset = async (asset: AssetConfig, baseName: string, files: AssetFile[], comboParts: Array<{ assetType: string; allowedExtensions?: string[] }>) => {
    if (!newFileName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    if (newFileName === baseName) {
      setRenamingFile(null);
      setNewFileName("");
      return;
    }

    try {
      const dirPath = asset.path.endsWith('/') ? asset.path : asset.path + '/';

      for (const file of files) {
        const ext = getFileExtension(file.name);
        const newFilePath = dirPath + newFileName + ext;
        const existingPending = pendingChanges.find(c => c.repoPath === file.path);

        let fileContent: string;

        if (existingPending) {
          fileContent = existingPending.content;
        } else {
          const isImage = isImageFile(file.name);

          if (isImage) {
            const response = await fetch(file.download_url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            fileContent = base64;
          } else {
            const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
              body: { site_id: siteId, asset_path: file.path },
            });

            if (error) throw error;

            if (!data.found) {
              toast.error("File not found");
              continue;
            }

            fileContent = btoa(unescape(encodeURIComponent(data.content)));
          }
        }

        const newChange: PendingAssetChange = {
          repoPath: newFilePath,
          content: fileContent,
          fileName: newFileName + ext
        };

        const existingIndex = pendingChanges.findIndex(c => c.repoPath === file.path);
        if (existingIndex >= 0) {
          const updated = [...pendingChanges];
          updated[existingIndex] = newChange;
          setPendingChanges(updated);
        } else {
          setPendingChanges([...pendingChanges, newChange]);
        }
      }

      setRenamingFile(null);
      setNewFileName("");
      toast.success(`Renamed "${baseName}" to "${newFileName}"`);
      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error('Error renaming combo asset:', error);
      toast.error(error.message || "Failed to rename combo asset");
    }
  };

  const handleReorderDirectoryItems = async (asset: AssetConfig, files: AssetFile[], newOrder: number[]) => {
    try {
      const reorderedFiles = newOrder.map(index => files[index]);
      const manifestContent = {
        files: reorderedFiles.map(file => file.name)
      };

      const manifestBlob = new Blob([JSON.stringify(manifestContent, null, 2)], { type: 'application/json' });
      const manifestPath = `${asset.path}/manifest.json`;

      const base64Content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.readAsDataURL(manifestBlob);
      });

      await saveToBatch({
        ...asset,
        path: manifestPath
      }, atob(base64Content));

      setDraggedItem(null);
      setDragOverItem(null);

      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error("Failed to update directory order:", error);
      toast.error(error.message || "Failed to update directory order");
    }
  };

  const handleAutoScroll = (e: React.DragEvent) => {
    const scrollZone = 80;
    const scrollSpeed = 10;

    const container = (e.currentTarget as HTMLElement).closest('[role="main"]')?.previousElementSibling;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const distanceFromTop = e.clientY - rect.top;
    const distanceFromBottom = rect.bottom - e.clientY;

    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    if (distanceFromTop < scrollZone && distanceFromTop > 0) {
      scrollIntervalRef.current = setInterval(() => {
        container.scrollTop -= scrollSpeed;
      }, 16);
    } else if (distanceFromBottom < scrollZone && distanceFromBottom > 0) {
      scrollIntervalRef.current = setInterval(() => {
        container.scrollTop += scrollSpeed;
      }, 16);
    }
  };

  const handleStopAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const handleReorderComboAssets = async (
    asset: AssetConfig,
    groups: [string, { files: AssetFile[]; types: string[] }][],
    fromIndex: number,
    toIndex: number
  ) => {
    try {
      const reorderedGroups = [...groups];
      const [movedGroup] = reorderedGroups.splice(fromIndex, 1);
      reorderedGroups.splice(toIndex, 0, movedGroup);

      const allFileNames: string[] = [];
      reorderedGroups.forEach(([baseName, group]) => {
        group.files.forEach(file => {
          allFileNames.push(file.name);
        });
      });

      const manifestContent = {
        files: allFileNames
      };

      const basePath = asset.path.endsWith('/') ? asset.path : asset.path + '/';
      const manifestPath = basePath + 'manifest.json';

      const base64Content = btoa(unescape(encodeURIComponent(JSON.stringify(manifestContent, null, 2))));

      await saveToBatch({
        ...asset,
        path: manifestPath
      }, JSON.stringify(manifestContent, null, 2));

      setDraggedComboItem(null);
      setDragOverComboItem(null);

      toast.success("Combo asset order updated");

      await loadDirectoryFiles(asset);
    } catch (error: any) {
      console.error("Failed to update combo asset order:", error);
      toast.error(error.message || "Failed to update combo asset order");
    }
  };

  const handleMoveComboAsset = async (
    asset: AssetConfig,
    groups: [string, { files: AssetFile[]; types: string[] }][],
    fromIndex: number,
    direction: 'up' | 'down'
  ) => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= groups.length) return;

    await handleReorderComboAssets(asset, groups, fromIndex, toIndex);
  };

  const handleMoveDirectoryItem = async (
    asset: AssetConfig,
    files: AssetFile[],
    fromIndex: number,
    direction: 'up' | 'down'
  ) => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= files.length) return;

    const newOrder = [...Array(files.length).keys()];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);

    await handleReorderDirectoryItems(asset, files, newOrder);
  };

  const loadComboFileContent = async (filePath: string) => {
    setLoadingComboFile(prev => ({ ...prev, [filePath]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: filePath },
      });

      if (error) throw error;

      if (data.found) {
        setComboFileContents(prev => ({ ...prev, [filePath]: data.content }));
      }
    } catch (error: any) {
      console.error("Failed to load combo file content:", error);
      toast.error("Failed to load file content");
    } finally {
      setLoadingComboFile(prev => ({ ...prev, [filePath]: false }));
    }
  };

  const handleComboFileContentChange = async (filePath: string, newContent: string) => {
    setComboFileContents(prev => ({ ...prev, [filePath]: newContent }));

    const base64Content = btoa(unescape(encodeURIComponent(newContent)));
    const fileName = filePath.split('/').pop() || 'file';

    let originalContent = "";
    try {
      const { data: originalData } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: filePath },
      });
      if (originalData?.found) {
        originalContent = originalData.content;
      }
    } catch (error) {
      console.error("Failed to fetch original content:", error);
    }

    const newChange: PendingAssetChange = {
      repoPath: filePath,
      content: base64Content,
      originalContent: originalContent ? btoa(unescape(encodeURIComponent(originalContent))) : undefined,
      fileName
    };

    const updatedChanges = pendingChanges.filter(c => c.repoPath !== filePath);
    setPendingChanges([...updatedChanges, newChange]);
  };

  const startCreatingCombo = (asset: AssetConfig) => {
    setCreatingCombo(prev => ({ ...prev, [asset.path]: true }));

    const parts: Record<string, { content: string; file?: File; jsonData?: Record<string, any> }> = {};

    asset.contains?.parts?.forEach(part => {
      if (part.assetType === 'json' && part.schema?.properties) {
        const jsonData: Record<string, any> = {};
        Object.entries(part.schema.properties).forEach(([key, fieldSchema]: [string, any]) => {
          jsonData[key] = fieldSchema.default ?? '';
        });
        parts[part.assetType] = { content: '', jsonData };
      }
    });

    setNewComboData(prev => ({
      ...prev,
      [asset.path]: {
        baseName: '',
        parts
      }
    }));
  };

  const cancelCreatingCombo = (assetPath: string) => {
    setCreatingCombo(prev => ({ ...prev, [assetPath]: false }));
    setNewComboData(prev => {
      const updated = { ...prev };
      delete updated[assetPath];
      return updated;
    });
  };

  const updateManifestWithNewFiles = async (dirPath: string, newFileNames: string[], updatedChanges: PendingAssetChange[]) => {
    const basePath = dirPath.endsWith('/') ? dirPath : dirPath + '/';
    const manifestPath = `${basePath}manifest.json`;

    try {
      let manifestContent = '';
      const existingPendingManifest = updatedChanges.find(c => c.repoPath === manifestPath);

      if (existingPendingManifest) {
        manifestContent = decodeURIComponent(escape(atob(existingPendingManifest.content)));
      } else {
        const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
          body: { site_id: siteId, asset_path: manifestPath },
        });

        if (!error && data.found) {
          manifestContent = data.content;
        }
      }

      let manifest: { files: string[] };
      if (manifestContent) {
        manifest = JSON.parse(manifestContent);
      } else {
        manifest = { files: [] };
      }

      let updated = false;
      for (const fileName of newFileNames) {
        if (!manifest.files.includes(fileName)) {
          manifest.files.push(fileName);
          updated = true;
        }
      }

      if (updated) {
        manifest.files.sort();

        const updatedManifestContent = JSON.stringify(manifest, null, 2);
        const base64Manifest = btoa(unescape(encodeURIComponent(updatedManifestContent)));

        const manifestChange: PendingAssetChange = {
          repoPath: manifestPath,
          content: base64Manifest,
          fileName: 'manifest.json'
        };

        const existingIndex = updatedChanges.findIndex(c => c.repoPath === manifestPath);
        if (existingIndex >= 0) {
          updatedChanges[existingIndex] = manifestChange;
        } else {
          updatedChanges.push(manifestChange);
        }

        console.log('[AssetManager] Updated manifest.json with new files:', newFileNames);
      }
    } catch (error) {
      console.error('[AssetManager] Failed to update manifest:', error);
    }
  };

  const submitNewCombo = async (asset: AssetConfig) => {
    const comboData = newComboData[asset.path];
    if (!comboData || !comboData.baseName.trim()) {
      toast.error("Please enter a base name for the combo asset");
      return;
    }

    const parts = asset.contains?.parts || [];
    const basePath = asset.path.endsWith('/') ? asset.path : asset.path + '/';

    for (const part of parts) {
      const ext = part.allowedExtensions?.[0] || '';
      const partKey = part.assetType;
      const partData = comboData.parts[partKey];

      if (!partData) {
        toast.error(`Please provide content for ${part.assetType} part`);
        return;
      }

      const hasFile = !!partData.file;
      const hasContent = !!partData.content && partData.content.trim().length > 0;
      const hasJsonData = partData.jsonData && Object.keys(partData.jsonData).length > 0;

      if (!hasFile && !hasContent && !hasJsonData) {
        toast.error(`Please provide content for ${part.assetType} part`);
        return;
      }
    }

    const changes: PendingAssetChange[] = [];
    const newFileNames: string[] = [];

    for (const part of parts) {
      const ext = part.allowedExtensions?.[0] || '';
      const partKey = part.assetType;
      const partData = comboData.parts[partKey];

      if (!partData) continue;

      const fileName = comboData.baseName + ext;
      const fullPath = basePath + fileName;
      newFileNames.push(fileName);

      let base64Content: string = '';

      if (partData.file) {
        const reader = new FileReader();
        base64Content = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            resolve((reader.result as string).split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(partData.file!);
        });
      } else {
        const contentToEncode = partData.jsonData
          ? JSON.stringify(partData.jsonData, null, 2)
          : partData.content;
        base64Content = btoa(unescape(encodeURIComponent(contentToEncode)));
      }

      changes.push({
        repoPath: fullPath,
        content: base64Content,
        fileName: fileName
      });
    }

    const updatedChanges = [...pendingChanges];
    changes.forEach(change => {
      const existing = updatedChanges.findIndex(c => c.repoPath === change.repoPath);
      if (existing >= 0) {
        updatedChanges[existing] = change;
      } else {
        updatedChanges.push(change);
      }
    });

    await updateManifestWithNewFiles(asset.path, newFileNames, updatedChanges);

    setPendingChanges(updatedChanges);
    toast.success(`Added combo asset "${comboData.baseName}" to batch`);
    cancelCreatingCombo(asset.path);
  };

  const createTemplatePr = async () => {
    setCreatingPr(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-site-assets-pr', {
        body: { site_id: siteId },
      });

      if (error) throw error;

      toast.success("Pull request created!");

      if (data.pr_url) {
        window.open(data.pr_url, '_blank');
      }
    } catch (error: any) {
      console.error("Failed to create PR:", error);
      toast.error(error.message || "Failed to create pull request");
    } finally {
      setCreatingPr(false);
    }
  };

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
    creatingPr,
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
    setCreatingPr,
    // Handlers
    handleRefresh,
    toggleExpanded,
    loadImageAsset,
    loadDirectoryFiles,
    loadAssetContent,
    saveToBatch,
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
};

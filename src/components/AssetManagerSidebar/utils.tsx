import { FileText, Image, FileJson, Folder, File } from "lucide-react";
import type { AssetFile } from "./types";

export const getAssetIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'text':
    case 'markdown':
      return <FileText className="h-4 w-4 text-blue-500" />;
    case 'image':
    case 'img':
      return <Image className="h-4 w-4 text-green-500" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-purple-500" />;
    case 'directory':
    case 'folder':
      return <Folder className="h-4 w-4 text-orange-500" />;
    default:
      return <File className="h-4 w-4 text-gray-500" />;
  }
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'No limit';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isImageFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
};

export const getFileBaseName = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
};

export const getFileExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(lastDot + 1) : '';
};

export const groupComboAssets = (files: AssetFile[], comboParts: Array<{ assetType: string; allowedExtensions?: string[] }>) => {
  const groups = new Map<string, { files: AssetFile[]; types: string[] }>();
  const standalone: AssetFile[] = [];

  files.forEach(file => {
    const baseName = getFileBaseName(file.name);
    const ext = getFileExtension(file.name);

    // Find which combo part this file belongs to
    const partType = comboParts.find(part =>
      part.allowedExtensions?.some(allowed => ext.toLowerCase() === allowed.toLowerCase())
    )?.assetType;

    if (partType) {
      if (!groups.has(baseName)) {
        groups.set(baseName, { files: [], types: [] });
      }
      const group = groups.get(baseName)!;
      group.files.push(file);
      group.types.push(partType);
    } else {
      standalone.push(file);
    }
  });

  return { groups: Array.from(groups.entries()), standalone };
};

export const getFileAssetType = (fileName: string, comboParts: Array<{ assetType: string; allowedExtensions?: string[] }>) => {
  const ext = getFileExtension(fileName);
  return comboParts.find(part =>
    part.allowedExtensions?.some(allowed => ext.toLowerCase() === allowed.toLowerCase())
  )?.assetType;
};

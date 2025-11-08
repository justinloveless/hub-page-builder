import { Image, Folder, FileText } from "lucide-react";

export const getAssetIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'image':
    case 'img':
      return <Image className="h-4 w-4 text-blue-500" />;
    case 'directory':
    case 'folder':
      return <Folder className="h-4 w-4 text-yellow-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

export const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'No limit';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isImageFile = (fileName: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};

export const getFileBaseName = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
};

export const getFileExtension = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
};

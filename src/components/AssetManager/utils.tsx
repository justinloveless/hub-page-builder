import { Image, Folder, FileText, Calendar } from "lucide-react";

export const getAssetIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'image':
    case 'img':
      return <Image className="h-5 w-5 text-blue-500" />;
    case 'directory':
    case 'folder':
      return <Folder className="h-5 w-5 text-yellow-500" />;
    case 'calendar':
    case 'events':
      return <Calendar className="h-5 w-5 text-purple-500" />;
    default:
      return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

export const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'No limit';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

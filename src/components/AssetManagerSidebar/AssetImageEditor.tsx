import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFileSize } from "./utils";
import { toast } from "sonner";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  maxSize?: number;
  allowedExtensions?: string[];
}

interface AssetImageEditorProps {
  asset: AssetConfig;
  imageUrl?: string;
  loading: boolean;
  index: number;
  onFileUpload: (file: File) => void;
}

export const AssetImageEditor = ({
  asset,
  imageUrl,
  loading,
  index,
  onFileUpload,
}: AssetImageEditorProps) => {
  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (asset.maxSize && file.size > asset.maxSize) {
        toast.error(`File size exceeds maximum of ${(asset.maxSize / 1024 / 1024).toFixed(1)} MB`);
        return;
      }
      onFileUpload(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {imageUrl && (
        <div className="space-y-2">
          <Label className="text-xs">Current Image</Label>
          <div className="relative border rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt={asset.label || asset.path}
              className="w-full h-auto"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`file-${index}`} className="text-xs">
          {imageUrl ? 'Replace Image' : 'Upload Image'}
        </Label>
        <Input
          id={`file-${index}`}
          type="file"
          accept={asset.allowedExtensions?.join(',') || 'image/*'}
          onChange={handleFileChange}
          className="text-xs"
        />
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>Max size: {formatFileSize(asset.maxSize)}</span>
          {asset.allowedExtensions && (
            <span>Types: {asset.allowedExtensions.join(', ')}</span>
          )}
        </div>
      </div>
    </div>
  );
};

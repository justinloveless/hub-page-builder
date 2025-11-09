import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { getAssetIcon, formatFileSize } from "./utils";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
}

interface AssetCardProps {
  asset: AssetConfig;
  onUpload: (asset: AssetConfig) => void;
}

export const AssetCard = ({ asset, onUpload }: AssetCardProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 mt-1">
        {getAssetIcon(asset.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="font-medium text-sm truncate">{asset.label || asset.path}</p>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {asset.type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono mb-1 break-all">
          {asset.path}
        </p>
        {asset.description && (
          <p className="text-xs text-muted-foreground">
            {asset.description}
          </p>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground">
          <span>Max: {formatFileSize(asset.maxSize)}</span>
          {asset.allowedExtensions && (
            <span className="break-all">
              Allowed: {asset.allowedExtensions.join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onUpload(asset)}
          className="flex-1 sm:flex-initial"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>
    </div>
  );
};

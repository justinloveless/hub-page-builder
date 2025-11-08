import { Badge } from "@/components/ui/badge";
import { AssetCard } from "./AssetCard";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
}

interface AssetListProps {
  config: {
    version: string;
    assets: AssetConfig[];
  };
  onUpload: (asset: AssetConfig) => void;
}

export const AssetList = ({ config, onUpload }: AssetListProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">Version {config.version}</Badge>
        <span>•</span>
        <span>{config.assets.length} asset{config.assets.length !== 1 ? 's' : ''} defined</span>
      </div>

      <div className="space-y-3">
        {config.assets.map((asset, index) => (
          <AssetCard
            key={index}
            asset={asset}
            onUpload={onUpload}
          />
        ))}
      </div>
    </div>
  );
};

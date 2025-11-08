import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getAssetIcon } from "./utils";
import { AssetTextEditor } from "./AssetTextEditor";
import { AssetImageEditor } from "./AssetImageEditor";

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

interface AssetItemProps {
  asset: AssetConfig;
  index: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  assetContents: Record<string, string>;
  loadingContent: Record<string, boolean>;
  imageUrls: Record<string, string>;
  onContentChange: (asset: AssetConfig, content: string) => void;
  onFileUpload: (asset: AssetConfig, file: File) => void;
  // Placeholder for other props that will be passed to directory/combo editors
  [key: string]: any;
}

export const AssetItem = ({
  asset,
  index,
  isExpanded,
  onToggleExpanded,
  assetContents,
  loadingContent,
  imageUrls,
  onContentChange,
  onFileUpload,
  ...rest
}: AssetItemProps) => {
  const isJsonWithSchema = asset.type === 'json' && asset.schema;
  const isTextAsset = (asset.type === 'text' || asset.type === 'markdown') && !isJsonWithSchema;
  const isImageAsset = asset.type === 'image' || asset.type === 'img';
  const isDirectoryAsset = asset.type === 'directory' || asset.type === 'folder';

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggleExpanded}
      className="w-full"
    >
      <div className="border border-border rounded-lg overflow-hidden w-full">
        <CollapsibleTrigger className={`w-full p-3 hover:bg-muted/50 transition-colors max-w-full ${isExpanded ? 'sticky top-0 z-10 bg-background shadow-sm' : ''}`}>
          <div className="flex items-start gap-2 w-full max-w-full">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-shrink-0 mt-0.5">
              {getAssetIcon(asset.type)}
            </div>
            <div className="flex-1 text-left min-w-0 max-w-full overflow-hidden">
              <div className="flex items-center gap-2 mb-1 w-full max-w-full">
                <p className="font-medium text-sm truncate flex-1 min-w-0">{asset.label || asset.path}</p>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {asset.type}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {asset.path}
              </p>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-3">
            {asset.description && (
              <p className="text-xs text-muted-foreground">
                {asset.description}
              </p>
            )}

            {isTextAsset && (
              <AssetTextEditor
                asset={asset}
                content={assetContents[asset.path] || ''}
                loading={loadingContent[asset.path] || false}
                onContentChange={(content) => {
                  // Update local state immediately
                }}
                onBlur={(content) => onContentChange(asset, content)}
              />
            )}

            {isImageAsset && (
              <AssetImageEditor
                asset={asset}
                imageUrl={imageUrls[asset.path]}
                loading={loadingContent[asset.path] || false}
                index={index}
                onFileUpload={(file) => onFileUpload(asset, file)}
              />
            )}

            {/* JSON, Directory, and Combo editors will be added here */}
            {/* For now, we'll keep them in the main component to avoid breaking changes */}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

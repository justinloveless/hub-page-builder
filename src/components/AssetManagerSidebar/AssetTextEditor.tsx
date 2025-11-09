import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { AssetConfig } from "./types";
import { useAssetManagerSidebarContext } from "./AssetManagerSidebarContext";

interface AssetTextEditorProps {
  asset: AssetConfig;
}

export const AssetTextEditor = ({
  asset,
}: AssetTextEditorProps) => {
  const {
    assetContents,
    loadingContent,
    setAssetContents,
    handleContentChange,
  } = useAssetManagerSidebarContext();
  
  const content = assetContents[asset.path] || '';
  const loading = loadingContent[asset.path] || false;
  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Current Content</Label>
      <Textarea
        value={content || ''}
        onChange={(e) => setAssetContents(prev => ({ ...prev, [asset.path]: e.target.value }))}
        onBlur={(e) => handleContentChange(asset, e.target.value)}
        placeholder="Enter content..."
        className="min-h-[100px] font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">Changes are automatically saved to batch</p>
    </div>
  );
};

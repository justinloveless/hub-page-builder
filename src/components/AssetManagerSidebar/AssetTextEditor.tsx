import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { AssetConfig } from "./types";
import { useAssetManagerSidebarContext } from "./AssetManagerSidebarContext";
import { MarkdownEditor } from "./MarkdownEditor";

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
    <div className="space-y-3">
      <Label className="text-xs">Current Content</Label>
      <MarkdownEditor
        value={content || ''}
        onChange={(value) => setAssetContents(prev => ({ ...prev, [asset.path]: value }))}
        onBlur={(value) => handleContentChange(asset, value)}
        placeholder="Enter content..."
        textareaClassName="min-h-[160px] font-mono text-xs"
        previewClassName="font-sans text-xs"
      />
      <p className="text-xs text-muted-foreground">Markdown preview available. Changes are automatically saved to batch.</p>
    </div>
  );
};

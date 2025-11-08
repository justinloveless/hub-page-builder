import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
}

interface AssetTextEditorProps {
  asset: AssetConfig;
  content: string;
  loading: boolean;
  onContentChange: (content: string) => void;
  onBlur: (content: string) => void;
}

export const AssetTextEditor = ({
  asset,
  content,
  loading,
  onContentChange,
  onBlur,
}: AssetTextEditorProps) => {
  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Current Content</Label>
      <Textarea
        value={content || ''}
        onChange={(e) => onContentChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        placeholder="Enter content..."
        className="min-h-[100px] font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">Changes are automatically saved to batch</p>
    </div>
  );
};

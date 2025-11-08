import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users } from "lucide-react";
import CreateShareDialog from "../CreateShareDialog";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
}

interface AssetManagerSidebarHeaderProps {
  version: string;
  assetCount: number;
  loading: boolean;
  onRefresh: () => void;
  assets: AssetConfig[];
  siteId: string;
}

export const AssetManagerSidebarHeader = ({
  version,
  assetCount,
  loading,
  onRefresh,
  assets,
  siteId,
}: AssetManagerSidebarHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-3 gap-2 w-full max-w-full">
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <Badge variant="secondary" className="text-xs flex-shrink-0">v{version}</Badge>
        <span className="text-xs text-muted-foreground whitespace-nowrap truncate">{assetCount} assets</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <CreateShareDialog
          siteId={siteId}
          assets={assets}
          trigger={
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <Users className="h-3 w-3" />
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-7 w-7 p-0 flex-shrink-0"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
};

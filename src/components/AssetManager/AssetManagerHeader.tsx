import { Button } from "@/components/ui/button";
import { RefreshCw, GitPullRequest, Users } from "lucide-react";
import CreateShareDialog from "../CreateShareDialog";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
}

interface AssetManagerHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onCreatePr: () => void;
  creatingPr: boolean;
  assets?: AssetConfig[];
  siteId: string;
}

export const AssetManagerHeader = ({
  loading,
  onRefresh,
  onCreatePr,
  creatingPr,
  assets,
  siteId,
}: AssetManagerHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h3 className="text-2xl font-semibold leading-none tracking-tight">Asset Manager</h3>
        <p className="text-sm text-muted-foreground">
          Manage site assets defined in site-assets.json
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {assets && assets.length > 0 && (
          <CreateShareDialog
            siteId={siteId}
            assets={assets}
            trigger={
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Collaborate
              </Button>
            }
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
        <Button
          size="sm"
          onClick={onCreatePr}
          disabled={creatingPr}
          className="text-xs sm:text-sm"
        >
          {creatingPr ? (
            <>
              <RefreshCw className="mr-1 sm:mr-2 h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Creating...</span>
              <span className="sm:hidden">PR...</span>
            </>
          ) : (
            <>
              <GitPullRequest className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Create Template PR</span>
              <span className="sm:hidden">Template PR</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

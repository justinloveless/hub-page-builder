import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, GitPullRequest } from "lucide-react";

interface AssetManagerSidebarNoConfigProps {
  onCreatePr: () => void;
  creatingPr: boolean;
}

export const AssetManagerSidebarNoConfig = ({ onCreatePr, creatingPr }: AssetManagerSidebarNoConfigProps) => {
  return (
    <Alert className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-sm">No Asset Configuration</AlertTitle>
      <AlertDescription className="text-xs">
        <p className="mb-2">
          No <code className="bg-muted px-1 py-0.5 rounded text-xs">site-assets.json</code> found.
        </p>

        <Button
          onClick={onCreatePr}
          disabled={creatingPr}
          size="sm"
          className="w-full"
        >
          {creatingPr ? (
            <>
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <GitPullRequest className="mr-2 h-3 w-3" />
              Create Template PR
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

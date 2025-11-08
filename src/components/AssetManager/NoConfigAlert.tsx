import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, GitPullRequest } from "lucide-react";

interface NoConfigAlertProps {
  onCreatePr: () => void;
  creatingPr: boolean;
}

export const NoConfigAlert = ({ onCreatePr, creatingPr }: NoConfigAlertProps) => {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>No Asset Configuration Found</AlertTitle>
      <AlertDescription>
        <p className="mb-3">
          No <code className="bg-muted px-1 py-0.5 rounded">site-assets.json</code> file found in the repository root.
          Create this file to define manageable assets for your site.
        </p>
        
        <Button 
          onClick={onCreatePr} 
          disabled={creatingPr}
          className="mb-3"
        >
          {creatingPr ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Creating PR...
            </>
          ) : (
            <>
              <GitPullRequest className="mr-2 h-4 w-4" />
              Create Template PR
            </>
          )}
        </Button>

        <div className="mt-3 p-3 bg-muted/50 rounded-md">
          <p className="text-xs font-medium mb-2">Example site-assets.json:</p>
          <pre className="text-xs overflow-x-auto">
{`{
  "version": "1.0",
  "description": "Configuration file for site assets",
  "assets": [
    {
      "path": "images/hero.jpg",
      "type": "image",
      "label": "Hero Image",
      "description": "Main homepage hero image",
      "maxSize": 2097152,
      "allowedExtensions": [".jpg", ".png", ".webp"]
    },
    {
      "path": "content/about.md",
      "type": "text",
      "label": "About Page",
      "description": "About page content",
      "maxSize": 51200,
      "allowedExtensions": [".md"]
    }
  ]
}`}
          </pre>
        </div>
      </AlertDescription>
    </Alert>
  );
};

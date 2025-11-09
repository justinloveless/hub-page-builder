import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import AssetUploadDialog from "./AssetUploadDialog";
import type { PendingAssetChange } from "@/pages/Manage";
import { useSiteAssets } from "@/hooks/useSiteAssets";
import { useQueryClient } from "@tanstack/react-query";
import { AssetManagerHeader } from "./AssetManager/AssetManagerHeader";
import { NoConfigAlert } from "./AssetManager/NoConfigAlert";
import { AssetList } from "./AssetManager/AssetList";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
}

interface AssetManagerProps {
  siteId: string;
  pendingChanges: PendingAssetChange[];
  setPendingChanges: (changes: PendingAssetChange[]) => void;
}

const AssetManager = ({ siteId, pendingChanges, setPendingChanges }: AssetManagerProps) => {
  const queryClient = useQueryClient();
  const { data: assetsData, isLoading: loading, refetch } = useSiteAssets(siteId);
  const [creatingPr, setCreatingPr] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetConfig | null>(null);

  const found = assetsData?.found ?? null;
  const config = assetsData?.config ?? null;

  const handleRefresh = async () => {
    await refetch();
  };

  const createTemplatePr = async () => {
    setCreatingPr(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-site-assets-pr', {
        body: { site_id: siteId },
      });

      if (error) throw error;

      toast.success("Pull request created successfully!");
      
      // Open the PR in a new tab
      if (data.pr_url) {
        window.open(data.pr_url, '_blank');
      }
    } catch (error: any) {
      console.error("Failed to create PR:", error);
      toast.error(error.message || "Failed to create pull request");
    } finally {
      setCreatingPr(false);
    }
  };

  const handleUpload = (asset: AssetConfig) => {
    setSelectedAsset(asset);
    setUploadDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <AssetManagerHeader
          loading={loading}
          onRefresh={handleRefresh}
          onCreatePr={createTemplatePr}
          creatingPr={creatingPr}
          assets={config?.assets}
          siteId={siteId}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : found === false ? (
          <NoConfigAlert onCreatePr={createTemplatePr} creatingPr={creatingPr} />
        ) : config ? (
          <AssetList config={config} onUpload={handleUpload} />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Click "Load Assets" to fetch the site asset configuration</p>
          </div>
        )}
      </CardContent>

      {selectedAsset && (
        <AssetUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          asset={selectedAsset}
          siteId={siteId}
          pendingChanges={pendingChanges}
          setPendingChanges={setPendingChanges}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['site-assets', siteId] });
            toast.success("Asset updated successfully!");
          }}
        />
      )}
    </Card>
  );
};

export default AssetManager;

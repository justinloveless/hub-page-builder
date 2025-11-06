import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AssetContentResponse {
  found: boolean;
  content?: string;
  sha?: string;
  download_url?: string;
}

export const useAssetContent = (siteId: string, assetPath: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['asset-content', siteId, assetPath],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { site_id: siteId, asset_path: assetPath },
      });

      if (error) throw error;
      return data as AssetContentResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: enabled && !!siteId && !!assetPath,
  });
};

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export const usePrefetchAssets = (siteId: string, assets: AssetConfig[] | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!assets || !siteId) return;

    // Prefetch content for all text/json/markdown/image assets
    assets.forEach(asset => {
      const shouldPrefetchContent = 
        asset.type === 'text' || 
        asset.type === 'json' || 
        asset.type === 'markdown' || 
        asset.type === 'image' || 
        asset.type === 'img';

      const shouldPrefetchDirectory = 
        asset.type === 'directory' || 
        asset.type === 'folder';

      if (shouldPrefetchContent) {
        queryClient.prefetchQuery({
          queryKey: ['asset-content', siteId, asset.path],
          queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
              body: { site_id: siteId, asset_path: asset.path },
            });
            if (error) throw error;
            return data;
          },
          staleTime: 5 * 60 * 1000,
        });
      }

      if (shouldPrefetchDirectory) {
        queryClient.prefetchQuery({
          queryKey: ['directory-files', siteId, asset.path],
          queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('list-directory-assets', {
              body: { site_id: siteId, asset_path: asset.path },
            });
            if (error) throw error;
            return data.files || [];
          },
          staleTime: 5 * 60 * 1000,
        });
      }
    });
  }, [assets, siteId, queryClient]);
};

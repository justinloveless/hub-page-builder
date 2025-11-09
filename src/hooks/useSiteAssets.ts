import { useQuery } from "@tanstack/react-query";
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
    allowedExtensions?: string[];
    maxSize?: number;
    schema?: Record<string, any>;
    parts?: Array<{
      assetType: string;
      allowedExtensions?: string[];
      maxSize?: number;
      schema?: Record<string, any>;
    }>;
  };
}

interface SiteAssetsConfig {
  version: string;
  assets: AssetConfig[];
}

interface SiteAssetsResponse {
  found: boolean;
  config?: SiteAssetsConfig;
  message?: string;
}

export const useSiteAssets = (siteId: string) => {
  return useQuery({
    queryKey: ['site-assets', siteId],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke('fetch-site-assets', {
        body: { site_id: siteId },
      });

      if (error) throw error;
      return data as SiteAssetsResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - cached data kept in memory
    enabled: !!siteId,
  });
};

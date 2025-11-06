import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AssetFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  download_url: string;
}

export const useDirectoryFiles = (siteId: string, assetPath: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['directory-files', siteId, assetPath],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-directory-assets', {
        body: { site_id: siteId, asset_path: assetPath },
      });

      if (error) throw error;
      return (data.files || []) as AssetFile[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: enabled && !!siteId && !!assetPath,
  });
};

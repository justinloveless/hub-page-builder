import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSiteFiles = (siteId: string, commitSha?: string) => {
  return useQuery({
    queryKey: ['site-files', siteId, commitSha],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('download-site-files', {
        body: { 
          site_id: siteId,
          ...(commitSha && { commit_sha: commitSha })
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      return data.files as Record<string, { content: string; encoding: string }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - cached data kept in memory
    enabled: !!siteId,
  });
};

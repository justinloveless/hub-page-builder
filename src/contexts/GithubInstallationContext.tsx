import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Repository {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
}

export interface GithubInstallation {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url: string;
  };
  repository_count: number;
  repositories: Repository[];
}

interface GithubInstallationContextValue {
  installations: GithubInstallation[];
  isLoading: boolean;
  error: string | null;
  hasInstallations: boolean;
  refreshInstallations: () => Promise<GithubInstallation[]>;
  markInstallationRemoved: (installationId: number | null) => void;
  resetState: () => void;
}

const GithubInstallationContext = createContext<GithubInstallationContextValue | undefined>(undefined);

interface GithubInstallationProviderProps {
  children: ReactNode;
}

export const GithubInstallationProvider = ({ children }: GithubInstallationProviderProps) => {
  const [installations, setInstallations] = useState<GithubInstallation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadInstallations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        setInstallations([]);
        return [];
      }

      const { data, error: fnError } = await supabase.functions.invoke("list-github-installations");
      if (fnError) {
        throw fnError;
      }

      const fetchedInstallations: GithubInstallation[] = data?.installations || [];
      setInstallations(fetchedInstallations);
      return fetchedInstallations;
    } catch (err: any) {
      console.error("Error loading GitHub installations:", err);
      const message = err?.message || "Failed to load GitHub installations";
      setInstallations([]);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        loadInstallations().catch(() => {
          // error already handled in loadInstallations
        });
      } else {
        setInstallations([]);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!isMounted) {
        return;
      }

      if (session) {
        loadInstallations().catch(() => {
          // handled inside loadInstallations
        });
      } else {
        setInstallations([]);
        setError(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadInstallations]);

  const markInstallationRemoved = useCallback((installationId: number | null) => {
    if (installationId === null) {
      setInstallations([]);
      return;
    }

    setInstallations((prev) => prev.filter((installation) => installation.id !== installationId));
  }, []);

  const resetState = useCallback(() => {
    setInstallations([]);
    setError(null);
  }, []);

  const hasInstallations = useMemo(() => installations.length > 0, [installations]);

  const value: GithubInstallationContextValue = {
    installations,
    isLoading,
    error,
    hasInstallations,
    refreshInstallations: loadInstallations,
    markInstallationRemoved,
    resetState,
  };

  return (
    <GithubInstallationContext.Provider value={value}>
      {children}
    </GithubInstallationContext.Provider>
  );
};

export const useGithubInstallations = () => {
  const context = useContext(GithubInstallationContext);
  if (context === undefined) {
    throw new Error("useGithubInstallations must be used within a GithubInstallationProvider");
  }
  return context;
};

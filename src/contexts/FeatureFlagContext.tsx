import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type FeatureFlag = Tables<'feature_flags'>;

interface FeatureFlagContextType {
  flags: Record<string, FeatureFlag>;
  isEnabled: (flagKey: string) => boolean;
  isLoading: boolean;
  refreshFlags: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

interface FeatureFlagProviderProps {
  children: ReactNode;
}

export function FeatureFlagProvider({ children }: FeatureFlagProviderProps) {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadFlags = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*');

      if (error) throw error;

      const flagMap = (data || []).reduce((acc, flag) => {
        acc[flag.flag_key] = flag;
        return acc;
      }, {} as Record<string, FeatureFlag>);

      setFlags(flagMap);
    } catch (error) {
      console.error('Error loading feature flags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('feature_flags_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags',
        },
        () => {
          loadFlags();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isEnabled = (flagKey: string): boolean => {
    const flag = flags[flagKey];
    if (!flag) return false;
    
    // Basic enabled check
    if (!flag.enabled) return false;

    // Check rollout percentage (simple random-based rollout)
    if (flag.rollout_percentage < 100) {
      // Use a deterministic hash based on the flag key for consistent behavior per user session
      const hash = flagKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const threshold = (hash % 100);
      return threshold < flag.rollout_percentage;
    }

    return true;
  };

  const refreshFlags = async () => {
    setIsLoading(true);
    await loadFlags();
  };

  return (
    <FeatureFlagContext.Provider value={{ flags, isEnabled, isLoading, refreshFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
}

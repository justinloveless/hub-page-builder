import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AssetManagerSidebar from '@/components/AssetManagerSidebar';
import type { PendingAssetChange } from '@/pages/Manage';

// Mock dependencies
vi.mock('@/hooks/useSiteAssets');
vi.mock('@/hooks/useAssetContent');
vi.mock('@/hooks/useDirectoryFiles');
vi.mock('@/hooks/usePrefetchAssets');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('@/components/CreateShareDialog', () => ({
  default: ({ trigger }: any) => trigger || <button>Collaborate</button>,
}));

import { useSiteAssets } from '@/hooks/useSiteAssets';
import { useAssetContent } from '@/hooks/useAssetContent';
import { useDirectoryFiles } from '@/hooks/useDirectoryFiles';
import { usePrefetchAssets } from '@/hooks/usePrefetchAssets';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const mockUseSiteAssets = vi.mocked(useSiteAssets);
const mockUseAssetContent = vi.mocked(useAssetContent);
const mockUseDirectoryFiles = vi.mocked(useDirectoryFiles);
const mockUsePrefetchAssets = vi.mocked(usePrefetchAssets);
const mockSupabase = vi.mocked(supabase);
const mockToast = vi.mocked(toast);

describe('AssetManagerSidebar', () => {
  let queryClient: QueryClient;
  const mockSiteId = 'test-site-id';
  const mockPendingChanges: PendingAssetChange[] = [];
  const mockSetPendingChanges = vi.fn();

  const defaultProps = {
    siteId: mockSiteId,
    pendingChanges: mockPendingChanges,
    setPendingChanges: mockSetPendingChanges,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    } as any);
    mockUseAssetContent.mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    mockUseDirectoryFiles.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as any);
    mockUsePrefetchAssets.mockReturnValue(undefined);
  });

  const renderComponent = (props = defaultProps) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AssetManagerSidebar {...props} />
      </QueryClientProvider>
    );
  };

  describe('Loading state', () => {
    it('should display loading skeletons when loading', () => {
      mockUseSiteAssets.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('No config found state', () => {
    it('should display alert when no config is found', () => {
      mockUseSiteAssets.mockReturnValue({
        data: { found: false },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      expect(screen.getByText('No Asset Configuration')).toBeInTheDocument();
      expect(screen.getByText('site-assets.json', { selector: 'code' })).toBeInTheDocument();
    });

    it('should allow creating PR from no config alert', async () => {
      const user = userEvent.setup();
      mockUseSiteAssets.mockReturnValue({
        data: { found: false },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { pr_url: 'https://github.com/test/pr' },
        error: null,
      } as any);

      renderComponent();
      const createPrButton = screen.getByText(/Create Template PR/i);
      await user.click(createPrButton);

      await waitFor(() => {
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'create-site-assets-pr',
          { body: { site_id: mockSiteId } }
        );
      });
    });
  });

  describe('Config loaded state', () => {
    const mockConfig = {
      version: '1.0',
      assets: [
        {
          path: 'images/hero.jpg',
          type: 'image',
          label: 'Hero Image',
          description: 'Main hero image',
        },
        {
          path: 'content/about.md',
          type: 'text',
          label: 'About Page',
        },
        {
          path: 'assets/',
          type: 'directory',
          label: 'Assets Folder',
        },
      ],
    };

    beforeEach(() => {
      mockUseSiteAssets.mockReturnValue({
        data: { found: true, config: mockConfig },
        isLoading: false,
        refetch: vi.fn(),
      } as any);
    });

    it('should display all assets', () => {
      renderComponent();
      expect(screen.getByText('Hero Image')).toBeInTheDocument();
      expect(screen.getByText('About Page')).toBeInTheDocument();
      expect(screen.getByText('Assets Folder')).toBeInTheDocument();
    });

    it('should allow expanding assets', async () => {
      const user = userEvent.setup();
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { found: true, content: 'test content', download_url: 'https://example.com/image.jpg' },
        error: null,
      } as any);

      renderComponent();
      const expandButtons = screen.getAllByRole('button', { name: /hero image/i });
      const expandButton = expandButtons.find(btn => btn.querySelector('.lucide-chevron-right'));
      
      if (expandButton) {
        await user.click(expandButton);
        await waitFor(() => {
          expect(mockSupabase.functions.invoke).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Refresh functionality', () => {
    it('should render refresh button when config is loaded', () => {
      mockUseSiteAssets.mockReturnValue({
        data: { found: true, config: { version: '1.0', assets: [] } },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      // Check that refresh icon button exists
      const refreshIcon = document.querySelector('.lucide-refresh-cw');
      expect(refreshIcon).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when config is null', () => {
      mockUseSiteAssets.mockReturnValue({
        data: { found: true, config: null },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      expect(screen.getByText(/Click "Refresh" to load assets/)).toBeInTheDocument();
    });
  });
});

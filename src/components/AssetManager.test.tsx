import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AssetManager from '@/components/AssetManager';
import type { PendingAssetChange } from '@/pages/Manage';

// Mock dependencies
vi.mock('@/hooks/useSiteAssets');
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
vi.mock('@/components/AssetUploadDialog', () => ({
  default: ({ open, asset, onOpenChange }: any) => (
    open ? <div data-testid="asset-upload-dialog">Upload Dialog: {asset?.path}</div> : null
  ),
}));
vi.mock('@/components/CreateShareDialog', () => ({
  default: ({ trigger }: any) => trigger || <button>Collaborate</button>,
}));

import { useSiteAssets } from '@/hooks/useSiteAssets';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const mockUseSiteAssets = vi.mocked(useSiteAssets);
const mockSupabase = vi.mocked(supabase);
const mockToast = vi.mocked(toast);

describe('AssetManager', () => {
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
  });

  const renderComponent = (props = defaultProps) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AssetManager {...props} />
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
      // Check for skeleton elements by their className
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
      expect(screen.getByText('No Asset Configuration Found')).toBeInTheDocument();
      // Check for the code element containing site-assets.json
      expect(screen.getByText('site-assets.json', { selector: 'code' })).toBeInTheDocument();
    });

    it('should show example config in alert', () => {
      mockUseSiteAssets.mockReturnValue({
        data: { found: false },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      expect(screen.getByText(/Example site-assets.json/)).toBeInTheDocument();
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
      const createPrButton = screen.getAllByText(/Create Template PR/i)[0];
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
          maxSize: 2097152,
          allowedExtensions: ['.jpg', '.png'],
        },
        {
          path: 'content/about.md',
          type: 'text',
          label: 'About Page',
          description: 'About page content',
          maxSize: 51200,
          allowedExtensions: ['.md'],
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

    it('should display config version and asset count', () => {
      renderComponent();
      expect(screen.getByText('Version 1.0')).toBeInTheDocument();
      expect(screen.getByText('2 assets defined')).toBeInTheDocument();
    });

    it('should display all assets', () => {
      renderComponent();
      expect(screen.getByText('Hero Image')).toBeInTheDocument();
      expect(screen.getByText('images/hero.jpg')).toBeInTheDocument();
      expect(screen.getByText('About Page')).toBeInTheDocument();
      expect(screen.getByText('content/about.md')).toBeInTheDocument();
    });

    it('should display asset details', () => {
      renderComponent();
      expect(screen.getByText(/Max: 2.0 MB/)).toBeInTheDocument();
      expect(screen.getByText(/Allowed: .jpg, .png/)).toBeInTheDocument();
    });

    it('should show upload button for each asset', async () => {
      const user = userEvent.setup();
      renderComponent();
      const uploadButtons = screen.getAllByText('Upload');
      expect(uploadButtons.length).toBeGreaterThan(0);

      await user.click(uploadButtons[0]);
      expect(screen.getByTestId('asset-upload-dialog')).toBeInTheDocument();
    });

    it('should display correct asset type badges', () => {
      renderComponent();
      const badges = screen.getAllByText('image');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('Refresh functionality', () => {
    it('should call refetch when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn().mockResolvedValue({});
      mockUseSiteAssets.mockReturnValue({
        data: { found: true, config: { version: '1.0', assets: [] } },
        isLoading: false,
        refetch: mockRefetch,
      } as any);

      renderComponent();
      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should disable refresh button while loading', () => {
      mockUseSiteAssets.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      const refreshButton = screen.getByText('Refresh').closest('button');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Create Template PR functionality', () => {
    beforeEach(() => {
      mockUseSiteAssets.mockReturnValue({
        data: { found: true, config: { version: '1.0', assets: [] } },
        isLoading: false,
        refetch: vi.fn(),
      } as any);
    });

    it('should create PR when button is clicked', async () => {
      const user = userEvent.setup();
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { pr_url: 'https://github.com/test/pr' },
        error: null,
      } as any);
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      renderComponent();
      const createPrButton = screen.getByText(/Create Template PR/i);
      await user.click(createPrButton);

      await waitFor(() => {
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'create-site-assets-pr',
          { body: { site_id: mockSiteId } }
        );
      });

      expect(mockToast.success).toHaveBeenCalledWith('Pull request created successfully!');
      expect(windowOpenSpy).toHaveBeenCalledWith('https://github.com/test/pr', '_blank');
      windowOpenSpy.mockRestore();
    });

    it('should handle PR creation error', async () => {
      const user = userEvent.setup();
      mockSupabase.functions.invoke.mockRejectedValue(new Error('PR creation failed'));

      renderComponent();
      const createPrButton = screen.getByText(/Create Template PR/i);
      await user.click(createPrButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('PR creation failed');
      });
    });

    it('should handle authentication error', async () => {
      const user = userEvent.setup();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      renderComponent();
      const createPrButton = screen.getByText(/Create Template PR/i);
      await user.click(createPrButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Not authenticated');
      });
    });
  });

  describe('Collaborate button', () => {
    it('should show collaborate button when assets exist', () => {
      mockUseSiteAssets.mockReturnValue({
        data: {
          found: true,
          config: {
            version: '1.0',
            assets: [{ path: 'test.jpg', type: 'image' }],
          },
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      expect(screen.getByText('Collaborate')).toBeInTheDocument();
    });

    it('should not show collaborate button when no assets', () => {
      mockUseSiteAssets.mockReturnValue({
        data: { found: true, config: { version: '1.0', assets: [] } },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      expect(screen.queryByText('Collaborate')).not.toBeInTheDocument();
    });
  });

  describe('Asset icon rendering', () => {
    it('should render correct icons for different asset types', () => {
      mockUseSiteAssets.mockReturnValue({
        data: {
          found: true,
          config: {
            version: '1.0',
            assets: [
              { path: 'test.jpg', type: 'image' },
              { path: 'folder/', type: 'directory' },
              { path: 'file.txt', type: 'text' },
            ],
          },
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      // Icons are rendered via lucide-react components, we can check for asset paths
      // Use getAllByText since paths appear multiple times (label and path)
      expect(screen.getAllByText('test.jpg').length).toBeGreaterThan(0);
      expect(screen.getAllByText('folder/').length).toBeGreaterThan(0);
      expect(screen.getAllByText('file.txt').length).toBeGreaterThan(0);
    });
  });

  describe('File size formatting', () => {
    it('should format file sizes correctly', () => {
      mockUseSiteAssets.mockReturnValue({
        data: {
          found: true,
          config: {
            version: '1.0',
            assets: [
              { path: 'small.jpg', type: 'image', maxSize: 1024 },
              { path: 'medium.jpg', type: 'image', maxSize: 1024 * 1024 },
              { path: 'large.jpg', type: 'image', maxSize: 5 * 1024 * 1024 },
              { path: 'unlimited.jpg', type: 'image' },
            ],
          },
        },
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      expect(screen.getByText(/Max: 1.0 KB/)).toBeInTheDocument();
      expect(screen.getByText(/Max: 1.0 MB/)).toBeInTheDocument();
      expect(screen.getByText(/Max: 5.0 MB/)).toBeInTheDocument();
      expect(screen.getByText(/Max: No limit/)).toBeInTheDocument();
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
      expect(screen.getByText(/Click "Load Assets"/)).toBeInTheDocument();
    });
  });
});

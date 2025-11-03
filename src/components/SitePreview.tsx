import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PendingAssetChange {
  repoPath: string;
  content: string;
  originalContent?: string;
  fileName: string;
}

interface SitePreviewProps {
  siteId: string;
  pendingChanges: PendingAssetChange[];
}

export const SitePreview = ({ siteId, pendingChanges }: SitePreviewProps) => {
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const filesRef = useRef<Record<string, { content: string; encoding: string }>>({});

  useEffect(() => {
    loadSiteFiles();
  }, [siteId]);

  useEffect(() => {
    if (Object.keys(filesRef.current).length > 0) {
      generatePreview();
    }
  }, [pendingChanges]);

  const loadSiteFiles = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('download-site-files', {
        body: { site_id: siteId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      filesRef.current = data.files;
      generatePreview();
    } catch (error) {
      console.error('Error loading site files:', error);
      toast.error('Failed to load site preview');
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = () => {
    // Create a virtual file system with pending changes applied
    const virtualFiles = { ...filesRef.current };

    // Apply pending changes
    pendingChanges.forEach(change => {
      const encoded = btoa(unescape(encodeURIComponent(change.content)));
      virtualFiles[change.repoPath] = {
        content: encoded,
        encoding: 'base64',
      };
    });

    // Find index.html
    const indexPath = Object.keys(virtualFiles).find(path => 
      path.endsWith('index.html') || path === 'index.html'
    );

    if (!indexPath) {
      toast.error('No index.html found in repository');
      return;
    }

    const indexFile = virtualFiles[indexPath];
    let indexHtml = indexFile.encoding === 'base64' 
      ? decodeURIComponent(escape(atob(indexFile.content)))
      : indexFile.content;

    // Helper to decode file content
    const getFileContent = (path: string): string => {
      const file = virtualFiles[path];
      if (!file) return '';
      return file.encoding === 'base64'
        ? decodeURIComponent(escape(atob(file.content)))
        : file.content;
    };

    // Helper to get MIME type
    const getMimeType = (path: string): string => {
      if (path.endsWith('.css')) return 'text/css';
      if (path.endsWith('.js')) return 'text/javascript';
      if (path.endsWith('.json')) return 'application/json';
      if (path.endsWith('.png')) return 'image/png';
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
      if (path.endsWith('.gif')) return 'image/gif';
      if (path.endsWith('.svg')) return 'image/svg+xml';
      return 'application/octet-stream';
    };

    // Replace CSS links with inline styles
    indexHtml = indexHtml.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, (match) => {
      const hrefMatch = match.match(/href=["']([^"']+)["']/);
      if (hrefMatch) {
        const cssPath = hrefMatch[1].replace(/^\.\//, '');
        const cssContent = getFileContent(cssPath);
        if (cssContent) {
          return `<style>${cssContent}</style>`;
        }
      }
      return match;
    });

    // Replace script tags with inline scripts
    indexHtml = indexHtml.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (match, before, src, after) => {
      const jsPath = src.replace(/^\.\//, '');
      const jsContent = getFileContent(jsPath);
      if (jsContent) {
        return `<script${before}${after}>${jsContent}</script>`;
      }
      return match;
    });

    // Replace image src attributes with data URLs
    indexHtml = indexHtml.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (match, before, src, after) => {
      const imgPath = src.replace(/^\.\//, '');
      const file = virtualFiles[imgPath];
      if (file && file.encoding === 'base64') {
        const mimeType = getMimeType(imgPath);
        return `${before}data:${mimeType};base64,${file.content}${after}`;
      }
      return match;
    });

    // Create blob URL
    const blob = new Blob([indexHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Clean up previous URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(url);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-[600px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-muted p-2 text-xs text-muted-foreground border-b">
        Preview with pending changes
      </div>
      <iframe
        ref={iframeRef}
        src={previewUrl}
        className="w-full h-[600px] border-0"
        sandbox="allow-scripts allow-same-origin"
        title="Site Preview"
      />
    </Card>
  );
};

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
      // Encode content as base64 for consistency
      const encoded = btoa(unescape(encodeURIComponent(change.content)));
      virtualFiles[change.repoPath] = {
        content: encoded,
        encoding: 'base64',
      };
    });

    // Process HTML and inject base tag + file resolver
    let indexHtml = '';
    const indexPath = Object.keys(virtualFiles).find(path => 
      path.endsWith('index.html') || path === 'index.html'
    );

    if (!indexPath) {
      toast.error('No index.html found in repository');
      return;
    }

    const indexFile = virtualFiles[indexPath];
    const decodedContent = indexFile.encoding === 'base64' 
      ? decodeURIComponent(escape(atob(indexFile.content)))
      : indexFile.content;

    // Create a file resolver script
    const fileMap = JSON.stringify(
      Object.fromEntries(
        Object.entries(virtualFiles).map(([path, file]) => [
          path,
          file.encoding === 'base64' 
            ? `data:application/octet-stream;base64,${file.content}`
            : file.content
        ])
      )
    );

    const resolverScript = `
      <script>
        window.__VIRTUAL_FILES__ = ${fileMap};
        
        // Intercept fetch requests
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
          const path = url.toString().replace(/^.\\//, '');
          if (window.__VIRTUAL_FILES__[path]) {
            return Promise.resolve(new Response(window.__VIRTUAL_FILES__[path]));
          }
          return originalFetch(url, options);
        };

        // Intercept image loading
        const originalImage = window.Image;
        window.Image = function() {
          const img = new originalImage();
          const originalSrcSetter = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
          Object.defineProperty(img, 'src', {
            set: function(value) {
              const path = value.replace(/^.\\//, '');
              if (window.__VIRTUAL_FILES__[path]) {
                originalSrcSetter.call(this, window.__VIRTUAL_FILES__[path]);
              } else {
                originalSrcSetter.call(this, value);
              }
            },
            get: function() {
              return this.getAttribute('src');
            }
          });
          return img;
        };
      </script>
    `;

    // Inject the resolver script before closing head tag
    indexHtml = decodedContent.replace('</head>', `${resolverScript}</head>`);

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

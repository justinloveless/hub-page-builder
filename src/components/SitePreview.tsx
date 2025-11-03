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

  // Add message listener for debug logs from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source === 'site-preview') {
        const { level, args } = event.data;
        console.log(`[Site Preview ${level.toUpperCase()}]`, ...args);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
      if (path.endsWith('.md')) return 'text/markdown';
      if (path.endsWith('.txt')) return 'text/plain';
      if (path.endsWith('.html')) return 'text/html';
      if (path.endsWith('.png')) return 'image/png';
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
      if (path.endsWith('.gif')) return 'image/gif';
      if (path.endsWith('.svg')) return 'image/svg+xml';
      if (path.endsWith('.webp')) return 'image/webp';
      if (path.endsWith('.woff') || path.endsWith('.woff2')) return 'font/woff2';
      if (path.endsWith('.ttf')) return 'font/ttf';
      if (path.endsWith('.otf')) return 'font/otf';
      return 'application/octet-stream';
    };

    // Helper to check if file is text-based
    const isTextFile = (path: string): boolean => {
      return path.endsWith('.json') || path.endsWith('.md') || path.endsWith('.txt') || 
             path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.js');
    };

    // Create blob URLs for all files
    const blobUrls: Record<string, string> = {};
    Object.keys(virtualFiles).forEach(path => {
      const file = virtualFiles[path];
      const mimeType = getMimeType(path);
      
      let blob: Blob;
      if (file.encoding === 'base64') {
        if (isTextFile(path)) {
          // Decode base64 to UTF-8 text for text files
          const decoded = decodeURIComponent(escape(atob(file.content)));
          blob = new Blob([decoded], { type: mimeType });
        } else {
          // Binary files - convert to Uint8Array
          const binaryString = atob(file.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: mimeType });
        }
      } else {
        // Already decoded text
        blob = new Blob([file.content], { type: mimeType });
      }
      
      blobUrls[path] = URL.createObjectURL(blob);
    });

    // Create fetch interceptor script
    const interceptorScript = `
      <script>
        (function() {
          // Bridge console to parent for debugging
          (function setupConsoleBridge() {
            const methods = ['log','info','warn','error'];
            methods.forEach(function(m) {
              const original = console[m];
              console[m] = function() {
                const args = Array.prototype.slice.call(arguments);
                try { 
                  if (window.parent) {
                    window.parent.postMessage({ 
                      source: 'site-preview', 
                      level: m, 
                      args: args.map(function(a) {
                        try { return typeof a === 'string' ? a : JSON.stringify(a); } 
                        catch (e) { return String(a); }
                      }) 
                    }, '*'); 
                  }
                } catch (e) {}
                return original.apply(console, args);
              };
            });
          })();

          console.log('[Site Preview] Interceptor script starting...');
          const fileMap = ${JSON.stringify(blobUrls)};
          console.log('[Site Preview] File map keys:', Object.keys(fileMap));

          function stripQueryHash(path) {
            return (path || '').split('#')[0].split('?')[0];
          }

          // Helper to resolve path against our virtual FS
          function resolvePath(path) {
            if (!path) return path;
            // Support URL and Request objects by converting to string first
            if (typeof path !== 'string') {
              try { path = String(path.url || path.href || path); } catch (e) { return path; }
            }
            const withoutQ = stripQueryHash(path);
            const dropPrefixes = function(p) { return p.replace(/^\\.\\//g, '').replace(/^\\//g, ''); };
            const base = dropPrefixes(withoutQ);
            const variants = [base, './' + base, '/' + base];
            for (var i = 0; i < variants.length; i++) {
              var v = variants[i];
              if (fileMap[v]) {
                console.log('[Site Preview] Resolved path:', path, '->', fileMap[v]);
                return fileMap[v];
              }
            }
            console.warn('[Site Preview] Could not resolve path:', path);
            return path;
          }

          // Intercept fetch
          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            try { console.log('[Site Preview] Fetch intercepted:', input); } catch {}
            var promise;
            if (typeof input === 'string' || input instanceof URL) {
              const resolved = resolvePath(input);
              promise = originalFetch.call(this, resolved, init);
            } else if (input && typeof input === 'object' && 'url' in input) {
              // Request object
              const resolvedUrl = resolvePath(input.url);
              const cloned = new Request(resolvedUrl, input);
              promise = originalFetch.call(this, cloned, init);
            } else {
              promise = originalFetch.call(this, input, init);
            }
            
            // Transform response to replace asset paths with blob URLs
            return promise.then(function(response) {
              const contentType = response.headers.get('content-type') || '';
              if (contentType.includes('application/json') || contentType.includes('text/')) {
                return response.text().then(function(text) {
                  // Replace all asset paths in the text with blob URLs
                  var transformed = text;
                  Object.keys(fileMap).forEach(function(path) {
                    // Simple string replacements for various path formats
                    var blobUrl = fileMap[path];
                    // Match exact path in quotes
                    transformed = transformed.split('"' + path + '"').join('"' + blobUrl + '"');
                    // Match with leading ./
                    transformed = transformed.split('"./' + path + '"').join('"' + blobUrl + '"');
                    // Match with leading /
                    transformed = transformed.split('"/' + path + '"').join('"' + blobUrl + '"');
                  });
                  
                  // Create new response with transformed content
                  return new Response(transformed, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                  });
                });
              }
              return response;
            });
          };

          // Intercept XMLHttpRequest
          const OriginalXHR = window.XMLHttpRequest;
          window.XMLHttpRequest = function() {
            const xhr = new OriginalXHR();
            const originalOpen = xhr.open;
            xhr.open = function(method, url) {
              var args = Array.prototype.slice.call(arguments, 2);
              const resolvedUrl = resolvePath(url);
              if (url !== resolvedUrl) { console.log('[Site Preview] XHR path resolved:', url, '->', resolvedUrl); }
              return originalOpen.apply(this, [method, resolvedUrl].concat(args));
            };
            return xhr;
          };

          // Intercept element attribute setting for src/href
          const originalSetAttribute = Element.prototype.setAttribute;
          Element.prototype.setAttribute = function(name, value) {
            if (name === 'src' || name === 'href' || name === 'srcset') {
              const resolved = resolvePath(value);
              if (resolved !== value) { try { console.log('[Site Preview] Attribute resolved:', name, value, '->', resolved); } catch {} }
              return originalSetAttribute.call(this, name, resolved);
            }
            return originalSetAttribute.call(this, name, value);
          };

          // Intercept Image constructor
          const OriginalImage = window.Image;
          window.Image = function() {
            const img = new OriginalImage();
            const originalSrcSet = Object.getOwnPropertyDescriptor(OriginalImage.prototype, 'src').set;
            Object.defineProperty(img, 'src', {
              set: function(value) {
                const resolved = resolvePath(value);
                originalSrcSet.call(this, resolved);
              },
              get: function() {
                return this.getAttribute('src');
              }
            });
            return img;
          };

          document.addEventListener('DOMContentLoaded', function() { console.log('[Site Preview] DOMContentLoaded'); });
          window.addEventListener('load', function() { console.log('[Site Preview] Window load'); });
          console.log('[Site Preview] Interceptor script completed');
        })();
      </script>
    `;

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

    // Replace script tags and inject asset paths
    indexHtml = indexHtml.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (match, before, src, after) => {
      const jsPath = src.replace(/^\.\//, '');
      let jsContent = getFileContent(jsPath);
      if (jsContent) {
        // Replace asset paths in JavaScript
        Object.keys(blobUrls).forEach(path => {
          const patterns = [
            new RegExp(`['"\`]\\.\\/+${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g'),
            new RegExp(`['"\`]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g')
          ];
          patterns.forEach(pattern => {
            jsContent = jsContent.replace(pattern, `"${blobUrls[path]}"`);
          });
        });
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

    // Inject interceptor script before any other scripts
    indexHtml = indexHtml.replace(/<head>/i, `<head>${interceptorScript}`);

    // Create blob URL
    const blob = new Blob([indexHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Clean up previous URLs
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

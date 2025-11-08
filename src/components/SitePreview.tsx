import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSiteFiles } from "@/hooks/useSiteFiles";

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
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const filesRef = useRef<Record<string, { content: string; encoding: string }>>({});
  const objectUrlsRef = useRef<string[]>([]);
  const scrollPositionRef = useRef<{ x: number; y: number } | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: siteFiles, isLoading: loading, error } = useSiteFiles(siteId);

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

  // Load files from cache when data is ready
  useEffect(() => {
    if (siteFiles) {
      filesRef.current = siteFiles;
      generatePreview();
    }
  }, [siteFiles]);

  // Show error if fetch failed
  useEffect(() => {
    if (error) {
      console.error('Error loading site files:', error);
      toast.error('Failed to load site preview');
    }
  }, [error]);

  useEffect(() => {
    if (Object.keys(filesRef.current).length > 0) {
      // Clear any existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set up debounced preview update (2 seconds)
      debounceTimeoutRef.current = setTimeout(() => {
        // Capture scroll position before regenerating preview
        const iframeEl = iframeRef.current;
        if (iframeEl && previewUrl) {
          try {
            const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
            if (iframeDoc) {
              scrollPositionRef.current = {
                x: iframeDoc.documentElement.scrollLeft || iframeDoc.body.scrollLeft || iframeEl.contentWindow?.scrollX || 0,
                y: iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop || iframeEl.contentWindow?.scrollY || 0,
              };
            }
          } catch (e) {
            // If we can't access iframe content (shouldn't happen with blob URLs), ignore
            console.debug('Could not capture scroll position:', e);
          }
        }
        generatePreview();
      }, 2000);
    }

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [pendingChanges]);

  const generatePreview = () => {
    // Create a virtual file system with pending changes applied
    const virtualFiles = { ...filesRef.current };

    // Apply pending changes (content is already base64-encoded)
    pendingChanges.forEach(change => {
      virtualFiles[change.repoPath] = {
        content: change.content,
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

    const resolveVirtualPath = (rawPath: string): string | null => {
      if (!rawPath) return null;
      const stripQueryHash = (value: string) => value.split('#')[0].split('?')[0];
      const dropLeading = (value: string) => value.replace(/^(\.\/)+/, '').replace(/^\/+/, '');

      const withoutExtras = dropLeading(stripQueryHash(rawPath));
      if (!withoutExtras) return null;

      const segments = withoutExtras.split('/').filter(Boolean);
      const candidates = new Set<string>();

      candidates.add(withoutExtras);
      candidates.add('./' + withoutExtras);
      candidates.add('/' + withoutExtras);

      if (segments.length > 1) {
        const withoutFirst = segments.slice(1).join('/');
        if (withoutFirst) {
          candidates.add(withoutFirst);
          candidates.add('./' + withoutFirst);
          candidates.add('/' + withoutFirst);
        }
      }

      for (const candidate of candidates) {
        const normalized = candidate.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
        if (normalized && virtualFiles[normalized]) {
          return normalized;
        }
      }

      const fileName = segments[segments.length - 1];
      if (fileName) {
        const matches = Object.keys(virtualFiles).filter(path =>
          path === fileName || path.endsWith('/' + fileName)
        );
        if (matches.length > 0) {
          matches.sort((a, b) => {
            const aIsSrc = a.startsWith('src/');
            const bIsSrc = b.startsWith('src/');
            if (aIsSrc !== bIsSrc) {
              return aIsSrc ? 1 : -1;
            }
            return a.length - b.length;
          });
          return matches[0];
        }
      }

      return null;
    };

    // Helper to decode file content
    const getFileContent = (path: string): string => {
      const resolvedPath = resolveVirtualPath(path);
      if (!resolvedPath) return '';
      const file = virtualFiles[resolvedPath];
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

    // Create blob URLs for images (for direct use in <img> tags)
    const blobUrls: Record<string, string> = {};
    // Store file content for fetch interception
    const fileContentMap: Record<string, { content: string; mimeType: string; encoding: string }> = {};
    // Capture previous batch URLs; revoke after new iframe loads
    const prevBatchUrls = objectUrlsRef.current.slice();
    objectUrlsRef.current = [];

    Object.keys(virtualFiles).forEach(path => {
      const file = virtualFiles[path];
      const mimeType = getMimeType(path);

      // Store content for fetch interception
      fileContentMap[path] = {
        content: file.content,
        mimeType,
        encoding: file.encoding || 'utf-8'
      };

      // Also create blob URLs for images (for <img> src attributes)
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

      const urlObj = URL.createObjectURL(blob);
      blobUrls[path] = urlObj;
      objectUrlsRef.current.push(urlObj);
    });

    // Create interceptor script
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
          const fileContentMap = ${JSON.stringify(fileContentMap)};
          const blobUrls = ${JSON.stringify(blobUrls)};
          console.log('[Site Preview] File map keys:', Object.keys(fileContentMap));

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
            // Skip blob, data, http, and https URLs - they're already resolved
            if (path.indexOf('blob:') === 0 || path.indexOf('data:') === 0 || 
                path.indexOf('http://') === 0 || path.indexOf('https://') === 0) {
              return path;
            }
            const withoutQ = stripQueryHash(path);
            const dropPrefixes = function(p) { return p.replace(/^(\\.\\/)+/g, '').replace(/^\\/+/, ''); };
            const base = dropPrefixes(withoutQ);
            if (!base) {
              console.warn('[Site Preview] Could not resolve empty path:', path);
              return null;
            }
            var variants = [base, './' + base, '/' + base];
            var parts = base.split('/');
            if (parts.length > 1) {
              var withoutFirst = parts.slice(1).join('/');
              if (withoutFirst) {
                variants.push(withoutFirst, './' + withoutFirst, '/' + withoutFirst);
              }
            }
            for (var i = 0; i < variants.length; i++) {
              var v = dropPrefixes(variants[i]);
              if (v && fileContentMap[v]) {
                console.log('[Site Preview] Resolved path:', path, '->', v);
                return v;
              }
            }
            // Try filename-only match in any directory with heuristics
            var fileName = base.split('/').pop();
            if (fileName) {
              var matches = [];
              for (var filePath in fileContentMap) {
                if (filePath.endsWith('/' + fileName) || filePath === fileName) {
                  matches.push(filePath);
                }
              }
              if (matches.length > 0) {
                matches.sort(function(a, b) {
                  var aIsSrc = a.indexOf('src/') === 0;
                  var bIsSrc = b.indexOf('src/') === 0;
                  if (aIsSrc !== bIsSrc) {
                    return aIsSrc ? 1 : -1;
                  }
                  return a.length - b.length;
                });
                console.log('[Site Preview] Resolved by filename match:', path, '->', matches[0]);
                return matches[0];
              }
            }
            console.warn('[Site Preview] Could not resolve path:', path);
            return null;
          }

          function resolveSrcset(value) {
            if (!value) return value;
            return value.split(',').map(function(part) {
              var trimmed = part.trim();
              if (!trimmed) return trimmed;
              var pieces = trimmed.split(/\s+/);
              var url = pieces.shift();
              var resolvedPath = resolvePath(url);
              // For images in srcset, use data URLs
              if (resolvedPath && fileContentMap[resolvedPath] && fileContentMap[resolvedPath].encoding === 'base64') {
                var fileData = fileContentMap[resolvedPath];
                var ext = resolvedPath.split('.').pop().toLowerCase();
                var mimeTypes = {
                  'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                  'png': 'image/png', 'gif': 'image/gif',
                  'webp': 'image/webp', 'svg': 'image/svg+xml',
                  'bmp': 'image/bmp', 'ico': 'image/x-icon'
                };
                var mimeType = mimeTypes[ext] || 'application/octet-stream';
                var finalUrl = 'data:' + mimeType + ';base64,' + fileData.content;
                return [finalUrl].concat(pieces).join(' ');
              }
              var finalUrl = (resolvedPath && blobUrls[resolvedPath]) || resolvedPath || url;
              return [finalUrl].concat(pieces).join(' ');
            }).join(', ');
          }

          function resolveCssUrls(value) {
            if (!value) return value;
            return value.replace(/url\(([^)]+)\)/gi, function(m, p1) {
              var raw = (p1 || '').trim().replace(/^['"]|['"]$/g, '');
              if (!raw || raw.indexOf('data:') === 0 || raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0 || raw.indexOf('blob:') === 0) return m;
              var resolvedPath = resolvePath(raw);
              // For images in CSS, use data URLs
              if (resolvedPath && fileContentMap[resolvedPath] && fileContentMap[resolvedPath].encoding === 'base64') {
                var fileData = fileContentMap[resolvedPath];
                var ext = resolvedPath.split('.').pop().toLowerCase();
                var mimeTypes = {
                  'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                  'png': 'image/png', 'gif': 'image/gif',
                  'webp': 'image/webp', 'svg': 'image/svg+xml',
                  'bmp': 'image/bmp', 'ico': 'image/x-icon'
                };
                var mimeType = mimeTypes[ext] || 'application/octet-stream';
                var finalUrl = 'data:' + mimeType + ';base64,' + fileData.content;
                return 'url("' + finalUrl + '")';
              }
              var finalUrl = (resolvedPath && blobUrls[resolvedPath]) || resolvedPath || raw;
              return 'url("' + finalUrl + '")';
            });
          }

          // Intercept fetch
          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            try { console.log('[Site Preview] Fetch intercepted:', input); } catch {}
            
            var pathToResolve;
            if (typeof input === 'string' || input instanceof URL) {
              pathToResolve = String(input);
            } else if (input && typeof input === 'object' && 'url' in input) {
              pathToResolve = input.url;
            }
            
            // Try to resolve the path
            if (pathToResolve) {
              const resolvedPath = resolvePath(pathToResolve);
              if (resolvedPath && fileContentMap[resolvedPath]) {
                // Create Response from file content
                const file = fileContentMap[resolvedPath];
                var responseBody;
                
                if (file.encoding === 'base64') {
                  // Decode base64
                  var binaryString = atob(file.content);
                  var bytes = new Uint8Array(binaryString.length);
                  for (var i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  responseBody = bytes;
                } else {
                  responseBody = file.content;
                }
                
                return Promise.resolve(new Response(responseBody, {
                  status: 200,
                  statusText: 'OK',
                  headers: { 'Content-Type': file.mimeType }
                }));
              }
            }
            
            // Pass through to original fetch
            var promise;
            if (typeof input === 'string' || input instanceof URL) {
              promise = originalFetch.call(this, input, init);
            } else if (input && typeof input === 'object' && 'url' in input) {
              promise = originalFetch.call(this, input, init);
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
                    var blobUrl = fileMap[path];
                    // Simple string replacements for various path formats
                    transformed = transformed.split('"' + path + '"').join('"' + blobUrl + '"');
                    transformed = transformed.split('"./' + path + '"').join('"' + blobUrl + '"');
                    transformed = transformed.split('"/' + path + '"').join('"' + blobUrl + '"');
                    transformed = transformed.split("'" + path + "'").join('"' + blobUrl + '"');
                    transformed = transformed.split("'./" + path + "'").join('"' + blobUrl + '"');
                    transformed = transformed.split("'/" + path + "'").join('"' + blobUrl + '"');
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

          // Intercept element attribute setting for src/href/srcset/style
          const originalSetAttribute = Element.prototype.setAttribute;
          Element.prototype.setAttribute = function(name, value) {
            if (name === 'src' || name === 'href') {
              const resolvedPath = resolvePath(value);
              // For src/href, use blob URL if available, otherwise use resolved path
              const finalUrl = (resolvedPath && blobUrls[resolvedPath]) || resolvedPath || value;
              if (finalUrl !== value) { try { console.log('[Site Preview] Attribute resolved:', name, value, '->', finalUrl); } catch {} }
              return originalSetAttribute.call(this, name, finalUrl);
            }
            if (name === 'srcset') {
              const resolvedSet = resolveSrcset(value);
              if (resolvedSet !== value) { try { console.log('[Site Preview] Srcset resolved:', value, '->', resolvedSet); } catch {} }
              return originalSetAttribute.call(this, name, resolvedSet);
            }
            if (name === 'style' && typeof value === 'string') {
              const resolvedStyle = resolveCssUrls(value);
              if (resolvedStyle !== value) { try { console.log('[Site Preview] Style url() resolved'); } catch {} }
              return originalSetAttribute.call(this, name, resolvedStyle);
            }
            return originalSetAttribute.call(this, name, value);
          };

          // Intercept style property changes (background/background-image)
          if (window.CSSStyleDeclaration && CSSStyleDeclaration.prototype && CSSStyleDeclaration.prototype.setProperty) {
            const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
            CSSStyleDeclaration.prototype.setProperty = function(name, value, priority) {
              try {
                if (typeof value === 'string' && (name === 'background' || name === 'background-image' || name === 'content')) {
                  value = resolveCssUrls(value);
                }
              } catch (e) {}
              return originalSetProperty.call(this, name, value, priority);
            };
          }

          // backgroundImage direct property
          if (window.CSSStyleDeclaration) {
            const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'backgroundImage');
            if (desc && desc.set) {
              Object.defineProperty(CSSStyleDeclaration.prototype, 'backgroundImage', {
                set: function(val) { try { desc.set.call(this, resolveCssUrls(val)); } catch (e) { desc.set.call(this, val); } },
                get: function() { return desc.get ? desc.get.call(this) : this.getPropertyValue('background-image'); }
              });
            }
          }


          // Intercept HTMLImageElement src property
          if (window.HTMLImageElement && HTMLImageElement.prototype) {
            const imgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
            if (imgSrcDesc && imgSrcDesc.set) {
              Object.defineProperty(HTMLImageElement.prototype, 'src', {
                set: function(value) {
                  const resolvedPath = resolvePath(value);
                  // For images, use fileContentMap to get base64 data
                  if (resolvedPath && fileContentMap[resolvedPath]) {
                    var fileData = fileContentMap[resolvedPath];
                    if (fileData.encoding === 'base64') {
                      var ext = resolvedPath.split('.').pop().toLowerCase();
                      var mimeTypes = {
                        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                        'png': 'image/png', 'gif': 'image/gif',
                        'webp': 'image/webp', 'svg': 'image/svg+xml',
                        'bmp': 'image/bmp', 'ico': 'image/x-icon'
                      };
                      var mimeType = mimeTypes[ext] || 'application/octet-stream';
                      var dataUrl = 'data:' + mimeType + ';base64,' + fileData.content;
                      try { console.log('[Site Preview] Image src set:', value, '->', 'data URL'); } catch {}
                      imgSrcDesc.set.call(this, dataUrl);
                      return;
                    }
                  }
                  // Fallback to blob URL for other resources
                  var finalUrl = (resolvedPath && blobUrls[resolvedPath]) || resolvedPath || value;
                  try { console.log('[Site Preview] Image src set:', value, '->', finalUrl); } catch {}
                  imgSrcDesc.set.call(this, finalUrl);
                },
                get: imgSrcDesc.get
              });
            }
          }
          
          // Intercept Image constructor
          const OriginalImage = window.Image;
          window.Image = function() {
            const img = new OriginalImage();
            const originalSrcSet = Object.getOwnPropertyDescriptor(OriginalImage.prototype, 'src').set;
            Object.defineProperty(img, 'src', {
              set: function(value) {
                const resolvedPath = resolvePath(value);
                const finalUrl = (resolvedPath && blobUrls[resolvedPath]) || resolvedPath || value;
                originalSrcSet.call(this, finalUrl);
              },
              get: function() {
                return this.getAttribute('src');
              }
            });
            // Also handle srcset property
            var imgSrcsetDesc = Object.getOwnPropertyDescriptor(OriginalImage.prototype, 'srcset');
            if (imgSrcsetDesc && imgSrcsetDesc.set) {
              Object.defineProperty(img, 'srcset', {
                set: function(value) {
                  var resolvedSet = resolveSrcset(value);
                  imgSrcsetDesc.set.call(this, resolvedSet);
                },
                get: function() { return this.getAttribute('srcset'); }
              });
            }
            return img;
          };

          // Intercept <source> srcset property
          if (window.HTMLSourceElement && HTMLSourceElement.prototype) {
            var sourceDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'srcset');
            if (sourceDesc && sourceDesc.set) {
              Object.defineProperty(HTMLSourceElement.prototype, 'srcset', {
                set: function(value) {
                  var resolvedSet = resolveSrcset(value);
                  sourceDesc.set.call(this, resolvedSet);
                },
                get: function() { return this.getAttribute('srcset'); }
              });
            }
          }

          console.log('[Site Preview] File map configured');
          
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
          // Rewrite url(...) references to blob URLs
          const rewritten = cssContent.replace(/url\(([^)]+)\)/gi, (m, p1) => {
            let raw = (p1 || '').trim().replace(/^['"]|['"]$/g, '');
            if (!raw || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('blob:')) {
              return m;
            }
            const key = raw.replace(/^\.\//, '').replace(/^\//, '');
            const mapped = blobUrls[key];
            if (mapped) {
              try { console.log('[Site Preview] CSS url resolved:', raw, '->', mapped); } catch { }
              return `url("${mapped}")`;
            }
            return m;
          });
          return `<style>${rewritten}</style>`;
        }
      }
      return match;
    });

    // Build import map - transform ALL JS files before creating data URLs
    const importMap: Record<string, string> = {};
    Object.keys(virtualFiles).forEach(path => {
      if (path.endsWith('.js')) {
        const file = virtualFiles[path];
        let content = file.encoding === 'base64'
          ? decodeURIComponent(escape(atob(file.content)))
          : file.content;

        console.log(`[SitePreview] Processing JS file for import map: ${path}`);

        // Transform imports in this file (recursively, since it might import other modules)
        // Transform static imports
        content = content.replace(
          /import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)(?:\s*,\s*)?)+\s+from\s+['"]([^'"]+)['"]/g,
          (match, importPath) => {
            // Don't transform if already a data URL
            if (importPath.startsWith('data:')) return match;
            console.log(`[SitePreview] Found static import in ${path}: ${importPath}`);
            return match; // Will be resolved later
          }
        );

        // Check for template literal dynamic imports
        const hasTemplateLiteralImports = /import\s*\(\s*`[^`]*`\s*\)/.test(content);
        if (hasTemplateLiteralImports) {
          console.log(`[SitePreview] ${path} has template literal dynamic imports - adding resolver`);
        }

        const dataUrl = `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(content)))}`;

        // Add multiple path variations to import map
        importMap[path] = dataUrl;
        importMap[`./${path}`] = dataUrl;
        importMap[`/${path}`] = dataUrl;

        // Also add filename-only for convenience
        const filename = path.split('/').pop();
        if (filename && filename !== path) {
          importMap[filename] = dataUrl;
          importMap[`./${filename}`] = dataUrl;
        }
      }
    });

    // Now transform all JS in import map to use data URLs for their imports
    Object.keys(virtualFiles).forEach(path => {
      if (path.endsWith('.js')) {
        const file = virtualFiles[path];
        let content = file.encoding === 'base64'
          ? decodeURIComponent(escape(atob(file.content)))
          : file.content;

        // Transform static imports to use import map
        content = content.replace(
          /import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)(?:\s*,\s*)?)+\s+from\s+['"]([^'"]+)['"]/g,
          (match, importPath) => {
            if (importPath.startsWith('data:')) return match;
            const dataUrl = importMap[importPath] || importMap[`./${importPath}`] || importMap[`/${importPath}`];
            if (dataUrl) {
              console.log(`[SitePreview] Transformed import in ${path}: ${importPath} -> data URL`);
              return match.replace(importPath, dataUrl);
            }
            return match;
          }
        );

        // Handle template literal dynamic imports
        const hasTemplateLiteralImports = /import\s*\(\s*`[^`]*`\s*\)/.test(content);
        if (hasTemplateLiteralImports) {
          // Add resolver
          const resolverCode = `
// Dynamic import resolver
if (typeof window.__moduleImportMap === 'undefined') {
  window.__moduleImportMap = ${JSON.stringify(importMap)};
  window.__resolveDynamicImport = function(path) {
    console.log('[Preview] Resolving:', path);
    const resolved = window.__moduleImportMap[path] || window.__moduleImportMap['./' + path] || window.__moduleImportMap['/' + path];
    if (resolved) return import(resolved);
    console.error('[Preview] Could not resolve:', path);
    return Promise.reject(new Error('Could not resolve: ' + path));
  };
}
`;
          content = resolverCode + content;

          // Transform template literal imports
          content = content.replace(
            /(await\s+)?import\s*\(\s*`([^`]+)`\s*\)/g,
            (match, awaitPrefix, templateContent) => {
              console.log(`[SitePreview] Transformed template import in ${path}: ${templateContent}`);
              return `${awaitPrefix || ''}__resolveDynamicImport(\`${templateContent}\`)`;
            }
          );
        }

        // Update import map with transformed content
        const transformedDataUrl = `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(content)))}`;
        importMap[path] = transformedDataUrl;
        importMap[`./${path}`] = transformedDataUrl;
        importMap[`/${path}`] = transformedDataUrl;
        const filename = path.split('/').pop();
        if (filename && filename !== path) {
          importMap[filename] = transformedDataUrl;
          importMap[`./${filename}`] = transformedDataUrl;
        }
      }
    });

    // Inline module scripts with transformed imports
    indexHtml = indexHtml.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (match, before, src, after) => {
      // Check if it's a module script
      const isModule = before.includes('type="module"') || before.includes("type='module'") ||
        after.includes('type="module"') || after.includes("type='module'");

      if (isModule) {
        const jsPath = src.replace(/^\.\//, '').replace(/^\//, '');
        console.log('[SitePreview] Inlining module script:', jsPath);

        const resolvedPath = resolveVirtualPath(jsPath);
        const jsContent = resolvedPath ? getFileContent(resolvedPath) : '';
        if (!resolvedPath || !jsContent) {
          console.warn('[SitePreview] Could not find module:', jsPath);
          return match;
        }

        // Transform imports to use data URLs directly
        let transformed = jsContent;

        // Transform static imports
        transformed = transformed.replace(
          /import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)(?:\s*,\s*)?)+\s+from\s+['"]([^'"]+)['"]/g,
          (match, importPath) => {
            const dataUrl = importMap[importPath] || importMap[`./${importPath}`] || importMap[`/${importPath}`];
            if (dataUrl) {
              return match.replace(importPath, dataUrl);
            }
            console.warn('[SitePreview] Could not resolve static import:', importPath);
            return match;
          }
        );

        // Transform dynamic imports (non-template literals)
        transformed = transformed.replace(
          /import\s*\(['"]([^'"]+)['"]\)/g,
          (match, importPath) => {
            const dataUrl = importMap[importPath] || importMap[`./${importPath}`] || importMap[`/${importPath}`];
            if (dataUrl) {
              return `import('${dataUrl}')`;
            }
            console.warn('[SitePreview] Could not resolve dynamic import:', importPath);
            return match;
          }
        );

        // Transform export...from statements
        transformed = transformed.replace(
          /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
          (match, importPath) => {
            const dataUrl = importMap[importPath] || importMap[`./${importPath}`] || importMap[`/${importPath}`];
            return dataUrl ? match.replace(importPath, dataUrl) : match;
          }
        ).replace(
          /export\s+{[^}]*}\s+from\s+['"]([^'"]+)['"]/g,
          (match, importPath) => {
            const dataUrl = importMap[importPath] || importMap[`./${importPath}`] || importMap[`/${importPath}`];
            return dataUrl ? match.replace(importPath, dataUrl) : match;
          }
        );

        // Handle template literal dynamic imports - add resolver function
        const hasTemplateLiteralImports = /import\s*\(\s*`[^`]*`\s*\)/.test(transformed);
        if (hasTemplateLiteralImports) {
          console.log('[SitePreview] Module has template literal dynamic imports, adding resolver');
          // Add import map to window for runtime resolution
          const resolverCode = `
// Dynamic import resolver for template literals
if (typeof window.__moduleImportMap === 'undefined') {
  window.__moduleImportMap = ${JSON.stringify(importMap)};
  window.__resolveDynamicImport = function(path) {
    console.log('[Preview] Resolving dynamic import:', path);
    const resolved = window.__moduleImportMap[path] || window.__moduleImportMap['./' + path] || window.__moduleImportMap['/' + path];
    if (resolved) {
      console.log('[Preview] Resolved to:', resolved.substring(0, 50) + '...');
      return import(resolved);
    }
    console.error('[Preview] Could not resolve dynamic import:', path);
    return Promise.reject(new Error('Could not resolve: ' + path));
  };
}
`;
          transformed = resolverCode + transformed;

          // Replace template literal imports with resolver calls - more robust regex
          transformed = transformed.replace(
            /(await\s+)?import\s*\(\s*`([^`]+)`\s*\)/g,
            (match, awaitPrefix, templateContent) => {
              console.log('[SitePreview] Transforming template literal import:', templateContent);
              return `${awaitPrefix || ''}__resolveDynamicImport(\`${templateContent}\`)`;
            }
          );
        }

        // Inline as regular module (not module-shim since we transformed everything)
        return `<script${before.replace(/src=["'][^"']+["']/g, '')}${after.replace(/src=["'][^"']+["']/g, '')} type="module">${transformed}</script>`;
      } else {
        // Non-module scripts - inline them as before
        const jsPath = src.replace(/^\.\//, '');
        const jsContent = getFileContent(jsPath);
        if (jsContent) {
          return `<script${before}${after}>${jsContent}</script>`;
        }
      }
      return match;
    });

    // Replace image src attributes with data URLs
    indexHtml = indexHtml.replace(/(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (match, before, src, after) => {
      const imgPath = src.replace(/^\.\//, '').replace(/^\//, '');
      const file = virtualFiles[imgPath];
      if (file && file.encoding === 'base64') {
        const mimeType = getMimeType(imgPath);
        return `${before}data:${mimeType};base64,${file.content}${after}`;
      }
      return match;
    });

    // Inject interceptor script before any other scripts
    indexHtml = indexHtml.replace(/<head>/i, `<head>${interceptorScript}`);

    // Create blob URL for HTML
    const blob = new Blob([indexHtml], { type: 'text/html' });
    const newUrl = URL.createObjectURL(blob);

    // Defer cleanup of previous URLs until iframe loads the new doc
    const oldPreviewUrl = previewUrl;
    const oldBatchUrls = prevBatchUrls;

    setPreviewUrl(newUrl);

    const iframeEl = iframeRef.current;
    if (iframeEl) {
      const onLoad = () => {
        try {
          if (oldPreviewUrl) URL.revokeObjectURL(oldPreviewUrl);
          if (oldBatchUrls.length) oldBatchUrls.forEach((u) => URL.revokeObjectURL(u));
        } catch (e) { }

        // Restore scroll position after iframe loads
        if (scrollPositionRef.current) {
          const restoreScroll = () => {
            try {
              const iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
              const iframeWindow = iframeEl.contentWindow;
              if (iframeWindow && iframeDoc) {
                iframeDoc.documentElement.scrollLeft = scrollPositionRef.current!.x;
                iframeDoc.documentElement.scrollTop = scrollPositionRef.current!.y;
                iframeDoc.body.scrollLeft = scrollPositionRef.current!.x;
                iframeDoc.body.scrollTop = scrollPositionRef.current!.y;
                iframeWindow.scrollTo(scrollPositionRef.current!.x, scrollPositionRef.current!.y);
              }
            } catch (e) {
              // If we can't access iframe content, ignore
              console.debug('Could not restore scroll position:', e);
            }
          };

          // Restore immediately and also after short delays to handle async content loading
          requestAnimationFrame(restoreScroll);
          setTimeout(restoreScroll, 100);
          setTimeout(restoreScroll, 500);
        }

        iframeEl.removeEventListener('load', onLoad);
      };
      iframeEl.addEventListener('load', onLoad);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (objectUrlsRef.current.length) {
        try { objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u)); } catch (e) { }
        objectUrlsRef.current = [];
      }
    };
  }, [previewUrl]);

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="bg-muted p-2 text-xs text-muted-foreground border-b flex-shrink-0">
        Preview with pending changes
      </div>
      <iframe
        ref={iframeRef}
        src={previewUrl}
        className="w-full flex-1 border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        title="Site Preview"
      />
    </Card>
  );
};

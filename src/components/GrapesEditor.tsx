import { useEffect, useRef, useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from 'grapesjs-preset-webpage';

// Helper function to load dynamic assets from site-assets.json
async function loadDynamicAssetsFromSiteData(editor: Editor, siteData: any, baseUrl: string, siteId: string) {
  if (!siteData?.assets) return;

  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  console.log('Loading dynamic assets from site-assets.json');

  // Process each asset defined in site-assets.json
  for (const asset of siteData.assets) {
    try {
      if (asset.type === 'directory' && asset.contains) {
        // Handle directory assets (like blog posts)
        await loadDirectoryAsset(editor, asset, baseUrl, wrapper);
      } else if (asset.type === 'json') {
        // Handle JSON file assets (like hero.json, author.json, etc.)
        await loadJsonAsset(editor, asset, baseUrl, wrapper);
      }
    } catch (error) {
      console.error(`Failed to load asset ${asset.path}:`, error);
    }
  }
}

// Load a directory asset (e.g., posts directory)
async function loadDirectoryAsset(
  editor: Editor,
  asset: any,
  baseUrl: string,
  wrapper: any
) {
  const dirPath = asset.path;

  // Check if asset has explicit targets defined
  if (!asset.targets || !Array.isArray(asset.targets)) {
    console.warn(`No targets defined for directory asset ${dirPath}`);
    return;
  }

  // Try to fetch manifest.json for the directory
  const manifestResponse = await fetch(`${baseUrl}${dirPath}/manifest.json`);
  if (!manifestResponse.ok) {
    console.log(`No manifest.json found for ${dirPath}`);
    return;
  }

  const manifest = await manifestResponse.json();
  const files = manifest.files || [];

  // Fetch all files
  const items = await Promise.all(
    files.map(async (file: string) => {
      try {
        const res = await fetch(`${baseUrl}${dirPath}/${file}`);
        if (!res.ok) return null;
        return await res.json();
      } catch (error) {
        console.error(`Failed to load ${dirPath}/${file}:`, error);
        return null;
      }
    })
  );

  const validItems = items.filter(item => item !== null);
  console.log(`Loaded ${validItems.length} items from ${dirPath}`);

  // Sort by date if items have a date field
  if (validItems.length > 0 && validItems[0].date) {
    validItems.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }

  // Inject items into each target container as defined in site-assets.json
  for (const target of asset.targets) {
    // Support three ways to specify targets:
    // 1. elementId: shorthand for #id
    // 2. className: shorthand for .class
    // 3. selector: any complex CSS selector
    const selector = target.selector ||
      (target.elementId ? `#${target.elementId}` : null) ||
      (target.className ? `.${target.className}` : null);

    if (!selector) {
      console.warn('Target must have selector, elementId, or className');
      continue;
    }

    const container = wrapper.find(selector)[0];

    if (container && validItems.length > 0) {
      container.components().reset();

      // Apply filters if specified
      let filteredItems = validItems;
      if (target.filter) {
        filteredItems = validItems.filter((item: any) => {
          return Object.entries(target.filter).every(([key, value]) => item[key] === value);
        });
      }

      // Determine how many items to show based on mode
      let itemsToShow = filteredItems;
      if (target.mode === 'single') {
        itemsToShow = filteredItems.slice(0, 1);
      } else if (typeof target.limit === 'number') {
        itemsToShow = filteredItems.slice(0, target.limit);
      }

      itemsToShow.forEach((item: any) => {
        container.append({
          type: 'blog-post-card',
          attributes: {
            'data-title': item.title || '',
            'data-excerpt': item.excerpt || item.description || '',
            'data-date': item.date ? formatDate(item.date) : '',
            'data-read-time': item.readTime ? `${item.readTime} min read` : '',
            'data-image': item.featuredImage || item.image || '',
            'data-tags': item.tags ? item.tags.join(', ') : '',
          },
        });
      });

      console.log(`Injected ${itemsToShow.length} items into ${selector} (mode: ${target.mode || 'list'})`);
    }
  }
}

// Load a JSON asset (e.g., hero.json, author.json)
async function loadJsonAsset(editor: Editor, asset: any, baseUrl: string, wrapper: any) {
  try {
    const response = await fetch(`${baseUrl}${asset.path}`);
    if (!response.ok) {
      console.log(`Could not fetch ${asset.path}`);
      return;
    }

    const data = await response.json();
    console.log(`Loaded ${asset.path}:`, data);

    // Check if asset has explicit targets defined
    if (!asset.targets || !Array.isArray(asset.targets)) {
      console.warn(`No targets defined for JSON asset ${asset.path}`);
      return;
    }

    // Inject data into each target element as defined in site-assets.json
    for (const target of asset.targets) {
      // Support three ways to specify targets:
      // 1. elementId: shorthand for #id
      // 2. className: shorthand for .class
      // 3. selector: any complex CSS selector
      const selector = target.selector ||
        (target.elementId ? `#${target.elementId}` : null) ||
        (target.className ? `.${target.className}` : null);

      if (!selector) {
        console.warn('Target must have selector, elementId, or className');
        continue;
      }

      const element = wrapper.find(selector)[0];

      if (element) {
        // If componentType is specified, create a component and inject it
        if (target.componentType) {
          element.components().reset();

          // Build attributes from all data fields
          const attributes: any = {};
          Object.keys(data).forEach(key => {
            const value = data[key];
            if (typeof value === 'string' || typeof value === 'number') {
              attributes[`data-${key}`] = String(value);
            }
          });

          element.append({
            type: target.componentType,
            attributes,
          });

          console.log(`Created ${target.componentType} component in ${selector} with data from ${asset.path}`);
        }
        // If a specific dataField is specified, set just that field
        else if (target.dataField && data[target.dataField] !== undefined) {
          const value = data[target.dataField];

          // Update the element's content based on its type
          if (typeof value === 'string' || typeof value === 'number') {
            // For text content, update textContent
            const view = element.view;
            if (view && view.el) {
              view.el.textContent = String(value);
            }
            // Also add as data attribute
            element.addAttributes({ [`data-${target.dataField}`]: String(value) });
          }

          console.log(`Injected ${target.dataField} from ${asset.path} into ${selector}`);
        } else {
          // If no specific field, inject all data as attributes
          Object.keys(data).forEach(key => {
            const value = data[key];
            if (typeof value === 'string' || typeof value === 'number') {
              element.addAttributes({ [`data-${key}`]: String(value) });
            }
          });
          console.log(`Injected all data from ${asset.path} into ${selector}`);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to load ${asset.path}:`, error);
  }
}

// Helper to format dates
function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

interface GrapesEditorProps {
  initialHtml?: string;
  initialCss?: string;
  externalStyles?: string[];  // Array of external stylesheet URLs
  externalScripts?: string[];  // Array of external script URLs
  siteData?: any;  // Data to inject into the canvas (e.g., from site-assets.json)
  githubPagesBaseUrl?: string;  // Base URL for GitHub Pages to resolve relative fetches
  siteId?: string;  // Site ID for fetching assets
  onSave?: (html: string, css: string) => void;
  onUpdate?: (html: string, css: string) => void;
}

export const GrapesEditor = ({
  initialHtml = '',
  initialCss = '',
  externalStyles = [],
  externalScripts = [],
  siteData,
  githubPagesBaseUrl = '',
  siteId = '',
  onSave,
  onUpdate
}: GrapesEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const grapesEditor = grapesjs.init({
      container: editorRef.current,
      height: '100%',
      width: '100%',
      storageManager: false,
      plugins: [gjsPresetWebpage],
      pluginsOpts: {
        [gjsPresetWebpage as any]: {
          blocksBasicOpts: {
            blocks: ['column1', 'column2', 'column3', 'column3-7', 'text', 'link', 'image', 'video'],
            flexGrid: 1,
          },
          blocks: ['link-block', 'quote', 'text-basic'],
          modalImportTitle: 'Import Template',
          modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
          modalImportContent: (editor: Editor) => {
            return `${editor.getHtml()}<style>${editor.getCss()}</style>`;
          },
          importPlaceholder: '<table class="table"><tr><td>Content here</td></tr></table>',
          filestackOpts: null,
          aviaryOpts: false,
          customStyleManager: [],
        },
      },
      canvas: {
        styles: externalStyles,  // Load external stylesheets into the canvas
        scripts: [
          // Inject fetch interceptor before loading other scripts
          'data:text/javascript;base64,' + btoa(`
            // Store the original fetch
            const originalFetch = window.fetch;
            
            // Intercept fetch calls to redirect to GitHub Pages
            window.fetch = function(...args) {
              let url = args[0];
              
              // If it's a relative URL, convert it to absolute GitHub Pages URL
              if (typeof url === 'string' && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//') && !url.startsWith('data:') && !url.startsWith('blob:')) {
                // Get the GitHub Pages base URL from a meta tag we'll inject
                const baseUrl = document.querySelector('meta[name="github-pages-base"]')?.content;
                if (baseUrl) {
                  url = url.startsWith('/') ? baseUrl + url.substring(1) : baseUrl + url;
                  args[0] = url;
                  console.log('Fetch intercepted and redirected to:', url);
                }
              }
              
              return originalFetch.apply(this, args);
            };
          `),
          ...externalScripts
        ],  // Load external scripts into the canvas
      },
      panels: {
        defaults: [
          {
            id: 'basic-actions',
            el: '.panel__basic-actions',
            buttons: [
              {
                id: 'visibility',
                active: true,
                className: 'btn-toggle-borders',
                label: '<i class="fa fa-clone"></i>',
                command: 'sw-visibility',
              },
              {
                id: 'preview',
                className: 'btn-preview',
                label: '<i class="fa fa-eye"></i>',
                command: 'preview',
              },
              {
                id: 'fullscreen',
                className: 'btn-fullscreen',
                label: '<i class="fa fa-arrows-alt"></i>',
                command: 'fullscreen',
                context: 'fullscreen',
              },
              {
                id: 'export',
                className: 'btn-export',
                label: '<i class="fa fa-code"></i>',
                command: 'export-template',
              },
              {
                id: 'undo',
                className: 'btn-undo',
                label: '<i class="fa fa-undo"></i>',
                command: 'core:undo',
              },
              {
                id: 'redo',
                className: 'btn-redo',
                label: '<i class="fa fa-repeat"></i>',
                command: 'core:redo',
              },
              {
                id: 'clear-all',
                className: 'btn-clear',
                label: '<i class="fa fa-trash"></i>',
                command: 'core:canvas-clear',
              },
            ],
          },
          {
            id: 'panel-devices',
            el: '.panel__devices',
            buttons: [
              {
                id: 'device-desktop',
                label: '<i class="fa fa-desktop"></i>',
                command: 'set-device-desktop',
                active: true,
                togglable: false,
              },
              {
                id: 'device-tablet',
                label: '<i class="fa fa-tablet"></i>',
                command: 'set-device-tablet',
                togglable: false,
              },
              {
                id: 'device-mobile',
                label: '<i class="fa fa-mobile"></i>',
                command: 'set-device-mobile',
                togglable: false,
              },
            ],
          },
        ],
      },
      deviceManager: {
        devices: [
          {
            name: 'Desktop',
            width: '',
          },
          {
            name: 'Tablet',
            width: '768px',
            widthMedia: '992px',
          },
          {
            name: 'Mobile',
            width: '375px',
            widthMedia: '480px',
          },
        ],
      },
    });

    // Define custom blog post component type
    grapesEditor.DomComponents.addType('blog-post-card', {
      model: {
        defaults: {
          tagName: 'div',
          draggable: true,
          droppable: false,
          attributes: { class: 'blog-post-card' },
          traits: [
            {
              type: 'text',
              label: 'Title',
              name: 'data-title',
            },
            {
              type: 'textarea',
              label: 'Excerpt',
              name: 'data-excerpt',
            },
            {
              type: 'text',
              label: 'Date',
              name: 'data-date',
            },
            {
              type: 'text',
              label: 'Read Time',
              name: 'data-read-time',
            },
            {
              type: 'text',
              label: 'Featured Image',
              name: 'data-image',
            },
          ],
        },
      },
      view: {
        onRender({ el, model }) {
          const title = model.getAttributes()['data-title'] || 'Untitled';
          const excerpt = model.getAttributes()['data-excerpt'] || 'No excerpt';
          const date = model.getAttributes()['data-date'] || '';
          const readTime = model.getAttributes()['data-read-time'] || '';
          const image = model.getAttributes()['data-image'] || '';
          const tags = model.getAttributes()['data-tags']?.split(',') || [];

          el.innerHTML = `
            <div class="cursor-pointer">
              ${image ? `<img src="${image}" alt="${title}" class="w-full h-48 object-cover rounded-lg mb-4">` : ''}
              <div>
                ${tags.length > 0 ? `
                  <div class="flex gap-2 mb-3 flex-wrap">
                    ${tags.map(tag => `<span class="px-2 py-1 bg-purple-100 text-purple-600 rounded-full text-xs">${tag.trim()}</span>`).join('')}
                  </div>
                ` : ''}
                <h3 class="text-xl font-bold mb-2">${title}</h3>
                <p class="text-gray-600 mb-4">${excerpt}</p>
                ${date || readTime ? `
                  <div class="flex items-center gap-4 text-sm text-gray-500">
                    ${date ? `<span>${date}</span>` : ''}
                    ${readTime ? `<span>${readTime}</span>` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        },
      },
    });

    // Define custom author card component type
    grapesEditor.DomComponents.addType('author-card', {
      model: {
        defaults: {
          tagName: 'div',
          draggable: true,
          droppable: false,
          attributes: { class: 'author-card' },
          traits: [
            { type: 'text', label: 'Name', name: 'data-name' },
            { type: 'text', label: 'Role', name: 'data-role' },
            { type: 'textarea', label: 'Bio', name: 'data-bio' },
            { type: 'text', label: 'Avatar URL', name: 'data-avatar' },
            { type: 'text', label: 'Location', name: 'data-location' },
            { type: 'text', label: 'Email', name: 'data-email' },
          ],
        },
      },
      view: {
        onRender({ el, model }) {
          const attrs = model.getAttributes();
          const name = attrs['data-name'] || 'Author Name';
          const role = attrs['data-role'] || '';
          const bio = attrs['data-bio'] || '';
          const avatar = attrs['data-avatar'] || 'https://via.placeholder.com/200';
          const location = attrs['data-location'] || '';
          const email = attrs['data-email'] || '';

          el.innerHTML = `
            <div class="flex-shrink-0">
              <img 
                src="${avatar}" 
                alt="${name}"
                class="w-48 h-48 rounded-full object-cover shadow-lg"
              >
            </div>
            <div class="flex-1 text-center md:text-left">
              <h3 class="text-3xl font-bold text-gray-900 mb-2">${name}</h3>
              ${role ? `<p class="text-purple-600 font-semibold mb-4">${role}</p>` : ''}
              <p class="text-gray-700 text-lg leading-relaxed mb-6">${bio}</p>
              <div class="flex flex-wrap gap-4 justify-center md:justify-start text-gray-600">
                ${location ? `
                  <div class="flex items-center gap-2">
                    <i class="fas fa-map-marker-alt text-purple-600"></i>
                    <span>${location}</span>
                  </div>
                ` : ''}
                ${email ? `
                  <div class="flex items-center gap-2">
                    <i class="fas fa-envelope text-purple-600"></i>
                    <a href="mailto:${email}" class="hover:text-purple-600 transition">${email}</a>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        },
      },
    });

    // Load initial content
    if (initialHtml || initialCss) {
      grapesEditor.setComponents(initialHtml);
      grapesEditor.setStyle(initialCss);
    }

    // Inject GitHub Pages base URL and site data into the canvas iframe
    grapesEditor.on('load', async () => {
      const iframe = grapesEditor.Canvas.getFrameEl();
      const iframeWindow = iframe?.contentWindow;
      const iframeDocument = iframe?.contentDocument;

      if (iframeWindow && iframeDocument) {
        // Inject a meta tag with the GitHub Pages base URL
        // This will be used by the fetch interceptor
        const meta = iframeDocument.createElement('meta');
        meta.name = 'github-pages-base';
        meta.content = githubPagesBaseUrl;
        iframeDocument.head.appendChild(meta);
        console.log('GitHub Pages base URL injected:', githubPagesBaseUrl);

        // Make the site data available globally in the iframe if provided
        if (siteData) {
          (iframeWindow as any).siteData = siteData;
          console.log('Site data injected into canvas:', siteData);

          // Load and inject dynamic assets if they exist
          try {
            await loadDynamicAssetsFromSiteData(grapesEditor, siteData, githubPagesBaseUrl, siteId);
          } catch (error) {
            console.error('Failed to load dynamic assets:', error);
          }
        }
      }
    });

    // Setup device commands
    grapesEditor.Commands.add('set-device-desktop', {
      run: (editor) => editor.setDevice('Desktop'),
    });
    grapesEditor.Commands.add('set-device-tablet', {
      run: (editor) => editor.setDevice('Tablet'),
    });
    grapesEditor.Commands.add('set-device-mobile', {
      run: (editor) => editor.setDevice('Mobile'),
    });

    // Setup export command
    grapesEditor.Commands.add('export-template', {
      run: (editor) => {
        const html = editor.getHtml();
        const css = editor.getCss();
        if (onSave) {
          onSave(html, css);
        }
      },
    });

    // Track changes
    grapesEditor.on('update', () => {
      if (onUpdate) {
        const html = grapesEditor.getHtml();
        const css = grapesEditor.getCss();
        onUpdate(html, css);
      }
    });

    setEditor(grapesEditor);

    return () => {
      grapesEditor.destroy();
    };
  }, []);

  return (
    <div className="grapes-editor-wrapper w-full h-full">
      <style>{`
        .grapes-editor-wrapper {
          display: flex;
          flex-direction: column;
        }
        .panel__basic-actions {
          display: flex;
          gap: 4px;
          padding: 8px;
          background: hsl(var(--card));
          border-bottom: 1px solid hsl(var(--border));
        }
        .panel__devices {
          display: flex;
          gap: 4px;
          padding: 8px;
          background: hsl(var(--card));
          border-bottom: 1px solid hsl(var(--border));
        }
        .gjs-one-bg {
          background-color: hsl(var(--background));
        }
        .gjs-two-color {
          color: hsl(var(--foreground));
        }
        .gjs-three-bg {
          background-color: hsl(var(--card));
          color: hsl(var(--card-foreground));
        }
        .gjs-four-color,
        .gjs-four-color-h:hover {
          color: hsl(var(--primary));
        }
        .gjs-btn-prim {
          background-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-radius: 6px;
          padding: 8px 16px;
        }
        .gjs-btn-prim:hover {
          opacity: 0.9;
        }
        .gjs-blocks-c {
          background-color: hsl(var(--card));
        }
        .gjs-block {
          background-color: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 4px;
          color: hsl(var(--foreground));
        }
        .gjs-block:hover {
          background-color: hsl(var(--accent));
        }
        .gjs-toolbar {
          background-color: hsl(var(--popover));
          border: 1px solid hsl(var(--border));
        }
        .gjs-toolbar-item {
          color: hsl(var(--popover-foreground));
        }
        .gjs-toolbar-item:hover {
          background-color: hsl(var(--accent));
        }
        .gjs-cv-canvas {
          background-color: hsl(var(--muted));
        }
        .gjs-frame {
          border: none;
        }
      `}</style>
      <div className="panel__basic-actions" />
      <div className="panel__devices" />
      <div ref={editorRef} className="flex-1" />
    </div>
  );
};

import { useEffect, useRef, useState } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from 'grapesjs-preset-webpage';

interface GrapesEditorProps {
  initialHtml?: string;
  initialCss?: string;
  onSave?: (html: string, css: string) => void;
  onUpdate?: (html: string, css: string) => void;
}

export const GrapesEditor = ({ 
  initialHtml = '', 
  initialCss = '', 
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
        styles: [],
        scripts: [],
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

    // Load initial content
    if (initialHtml || initialCss) {
      grapesEditor.setComponents(initialHtml);
      grapesEditor.setStyle(initialCss);
    }

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

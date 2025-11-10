import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import ComponentDebugger from "vite-plugin-component-debugger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && ComponentDebugger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'StaticSnack - GitHub Pages Site Manager',
        short_name: 'StaticSnack',
        description: 'Manage your static GitHub Pages sites with ease. Empower non-technical users to update content while developers maintain full control.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['developer tools', 'productivity', 'utilities'],
        lang: 'en-US',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-48.webp',
            sizes: '48x48',
            type: 'image/webp'
          },
          {
            src: '/icons/icon-72.webp',
            sizes: '72x72',
            type: 'image/webp'
          },
          {
            src: '/icons/icon-96.webp',
            sizes: '96x96',
            type: 'image/webp'
          },
          {
            src: '/icons/icon-128.webp',
            sizes: '128x128',
            type: 'image/webp'
          },
          {
            src: '/icons/icon-192.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'any'
          },
          {
            src: '/icons/icon-256.webp',
            sizes: '256x256',
            type: 'image/webp'
          },
          {
            src: '/icons/icon-512.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any maskable'
          },
          {
            src: '/favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webp}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

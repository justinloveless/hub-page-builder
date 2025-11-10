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
      devOptions: {
        enabled: true,
        type: 'module'
      },
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
        // Clean old caches automatically
        cleanupOutdatedCaches: true,
        // Skip waiting and claim clients immediately for faster updates
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Cache app shell with NetworkFirst - always try to get latest version
            urlPattern: ({ request, url }) => {
              return request.destination === 'document' || 
                     url.pathname.startsWith('/assets/') ||
                     url.pathname === '/' ||
                     url.pathname === '/index.html';
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell-v1',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Supabase API calls
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            // GitHub API calls
            urlPattern: /^https:\/\/api\.github\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'github-api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 2 // 2 hours
              }
            }
          },
          {
            // Images
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
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

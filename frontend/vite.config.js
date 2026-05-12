import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_URL = env.VITE_API_URL || 'http://localhost:5001';

  return {
    define: {
      // Inject API_URL as a global constant so service worker can access it
      'API_URL': JSON.stringify(API_URL),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png', 'favicon.ico'],
        manifest: {
          name: 'Mudiyanse Auto Solutions',
          short_name: 'MAS POS',
          description: 'Mudiyanse Auto Solutions — Spare Parts POS & Inventory',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: '/logo.png', sizes: '192x192', type: 'image/png' },
            { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              // Matches both localhost:5001 and *.up.railway.app API calls
              urlPattern: /\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
        },
      },
    },
  };
})


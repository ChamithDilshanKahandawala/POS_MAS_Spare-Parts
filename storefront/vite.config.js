import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Bundle analysis only — `ANALYZE=1 npm run build` writes stats.html to
    // dist/ and opens it; a normal build is unaffected.
    process.env.ANALYZE && visualizer({
      filename: process.env.ANALYZE_JSON ? 'dist/stats.json' : 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: process.env.ANALYZE_JSON ? 'raw-data' : 'treemap',
    }),
    VitePWA({
      // 'prompt', not 'autoUpdate' — a new deployment must never reload the
      // page out from under someone mid-checkout. UpdatePrompt.jsx is the
      // only thing that calls updateServiceWorker(), and only once the
      // visitor clicks "Refresh" on the toast it shows.
      registerType: 'prompt',
      // injectManifest, not the default generateSW — marking a cache-
      // served /api/products response (so the app can show the stale-data
      // banner even while navigator.onLine is still true) needs a real
      // plugin callback, and generateSW only supports a fixed set of
      // known, declaratively-serializable plugin shapes (expiration,
      // cacheableResponse, etc.), not arbitrary functions. The actual
      // caching rules live in src/sw.js now, not below.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['logo-96.png', 'logo-96.webp', 'robots.txt'],
      manifest: {
        // Apexora is the storefront's own brand (a marketplace); Mudiyanse
        // Auto Solutions is its one seller today, shown throughout the UI
        // as "Sold by Mudiyanse Auto Solutions" — see src/config/store.js's
        // PLATFORM_INFO/SELLERS split. The installed app itself is branded
        // as the platform, same as any marketplace app would be.
        name: 'Apexora',
        short_name: 'Apexora',
        description: "Sri Lanka's marketplace for quality vehicle parts and more, delivered island-wide.",
        theme_color: '#e67e22',
        background_color: '#faf9f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'en',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // App shell only (JS/CSS/HTML the build already produces). Icons
        // and the two logo files are deliberately NOT precached — they're
        // only needed at install-prompt time or in the navbar/footer,
        // fetched on demand via the browser's normal HTTP cache rather
        // than forced on every visitor up front.
        globPatterns: ['**/*.{js,css,html}'],
      },
    }),
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})


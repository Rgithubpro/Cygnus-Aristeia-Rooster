import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Cloudflare Workers Builds sets this on every build, so the app can show which commit is live.
const commit = (process.env.WORKERS_CI_COMMIT_SHA || '').slice(0, 7) || 'lokaal'

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest', // custom service worker (src/sw.js) for push notifications
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
      manifest: {
        id: '/',
        name: 'Klassenstrijd',
        short_name: 'Klassenstrijd',
        description: 'Jouw rooster voor de klassenstrijd.',
        lang: 'nl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#eef1f7',
        theme_color: '#14203d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})

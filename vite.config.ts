import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app under /<repo>/. Override with BASE_PATH for other hosts.
const base = process.env.BASE_PATH ?? '/knightlight/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Knightlight',
        short_name: 'Knightlight',
        description: 'Interactive chess lessons, puzzles and a teacher toolkit.',
        theme_color: '#0F3D3E',
        background_color: '#FFF8EC',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Puzzle data (about 3 MB) is precached so every level and theme works offline after the first visit.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'data/puzzles/**/*.json'],
        // Courses and openings are cached as they are first used.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'knightlight-data', expiration: { maxEntries: 400 } },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
});

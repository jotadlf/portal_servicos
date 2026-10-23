/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // A API local (server/, SQLite) roda em outra porta; o app a chama em /api, na mesma origem
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${process.env.API_PORT ?? 3001}`,
    },
  },
  test: {
    // e2e/ é do Playwright, com o próprio comando
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    // Navegador simulado para os testes de tela
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'Portal de Serviços',
        short_name: 'Serviços',
        description: 'Solicite e acompanhe serviços pelo portal.',
        theme_color: '#08695f',
        background_color: '#c4e5de',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})

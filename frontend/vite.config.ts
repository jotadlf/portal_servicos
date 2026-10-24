/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// A CSP do index.html já libera *.supabase.co. Supabase em outro endereço (o local dos testes,
// http://127.0.0.1:54321) entra na CSP só quando é ele o configurado.
function supabaseCsp(url: string | undefined): Plugin {
  return {
    name: 'portal-supabase-csp',
    transformIndexHtml(html) {
      if (!url || /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url)) return html
      const origin = new URL(url).origin
      return html
        .replace("img-src 'self'", `img-src 'self' ${origin}`)
        .replace("connect-src 'self'", `connect-src 'self' ${origin}`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd()), ...process.env }
  return {
    test: {
      // e2e/ é do Playwright, com o próprio comando
      exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
      // Navegador simulado para os testes de tela
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Um Supabase local só, voltado aos dados de exemplo antes de cada teste: um arquivo por vez
      fileParallelism: false,
    },
    plugins: [
      supabaseCsp(env.VITE_SUPABASE_URL),
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
          // Relativos: funcionam na raiz e na subpasta do Pages
          start_url: './',
          scope: './',
          icons: [
            {
              src: 'pwa-icon.svg',
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
  }
})

/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Demonstração do GitHub Pages: o Pages só serve arquivos, então a API de server/ roda
// dentro da página. Os módulos do Node que ela usa trocam por versões de navegador.
function demo(enabled: boolean): Plugin {
  const stub = '\0virtual:demo-stub'
  return {
    name: 'portal-demo',
    resolveId(id) {
      if (id !== 'virtual:demo') return undefined
      return enabled ? here('./src/demo/start.ts') : stub
    },
    load(id) {
      return id === stub ? 'export async function startDemo() {}' : undefined
    },
    // O SQLite da demonstração é WebAssembly, que a CSP só deixa rodar com 'wasm-unsafe-eval'
    transformIndexHtml(html) {
      return enabled ? html.replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'") : html
    },
  }
}

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo'
  const alias: Record<string, string> = isDemo
    ? {
        'node:crypto': here('./src/demo/shims/node-crypto.ts'),
        'node:util': here('./src/demo/shims/node-util.ts'),
        'node:zlib': here('./src/demo/shims/node-zlib.ts'),
        'node:sqlite': here('./src/demo/shims/node-sqlite.ts'),
        'node:fs': here('./src/demo/shims/node-fs.ts'),
        'node:path': here('./src/demo/shims/node-fs.ts'),
        'node:url': here('./src/demo/shims/node-fs.ts'),
      }
    : {}
  return {
    // No Pages o app fica em jotadlf.github.io/portal_servicos/
    base: isDemo ? '/portal_servicos/' : '/',
    // A API local (server/, SQLite) roda em outra porta; o app a chama em /api, na mesma origem
    server: {
      proxy: {
        '/api': `http://127.0.0.1:${process.env.API_PORT ?? 3001}`,
      },
    },
    resolve: { alias },
    test: {
      // e2e/ é do Playwright, com o próprio comando
      exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
      // Navegador simulado para os testes de tela
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
    plugins: [
      demo(isDemo),
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
          // wasm: o SQLite da demonstração, para abrir mesmo sem internet
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        },
      }),
    ],
  }
})

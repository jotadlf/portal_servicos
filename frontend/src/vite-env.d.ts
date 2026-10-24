/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Demonstração do GitHub Pages (src/demo/start.ts no modo "demo"; vazio nos demais)
declare module 'virtual:demo' {
  export function startDemo(): Promise<void>
}

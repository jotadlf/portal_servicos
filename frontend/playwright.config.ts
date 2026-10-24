// Testes de ponta a ponta num navegador de verdade: Vite + Supabase local, como no uso real.
// Precisa do Supabase local no ar (`supabase start`) e das variáveis VITE_SUPABASE_* apontando
// para ele; o banco volta aos dados de exemplo no começo de cada execução.
import { defineConfig, devices } from '@playwright/test'

const WEB_PORT = 5174

// Os testes criam contas e mudam dados: só contra o Supabase local, nunca o do projeto
// (que o Vite leria do .env.local se a variável não viesse do ambiente)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(SUPABASE_URL)) {
  throw new Error('Rode o e2e com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do Supabase local (supabase status).')
}
const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // Um banco só para a execução inteira: os testes rodam em sequência e usam dados próprios
  workers: 1,
  fullyParallel: false,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'] } },
    // Celular com o mesmo Chromium (não precisa baixar outro navegador)
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite --port ${WEB_PORT} --strictPort`,
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: false,
  },
})

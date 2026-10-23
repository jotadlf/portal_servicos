// Testes de ponta a ponta num navegador de verdade: API + SQLite + Vite, como no uso real.
// `npm run test:e2e` sobe tudo sozinho, com um banco novo a cada execução.
import { defineConfig, devices } from '@playwright/test'

const API_PORT = 3101
const WEB_PORT = 5174
const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'e2e',
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
  webServer: [
    {
      command: 'node server/index.ts',
      env: { PORT: String(API_PORT), PORTAL_DB: 'test-results/e2e.sqlite', PORTAL_DB_RESET: '1' },
      url: `http://127.0.0.1:${API_PORT}/api/plano`,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      env: { API_PORT: String(API_PORT) },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
    },
  ],
})

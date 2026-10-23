import { expect, type Page } from '@playwright/test'

let counter = 0
export function uniqueEmail(prefix = 'e2e') {
  counter += 1
  return `${prefix}.${counter}.${Date.now()}@exemplo.com`
}

// CPF válido novo a cada chamada: 9 dígitos aleatórios + os dois verificadores
export function randomCpf() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits.every((d) => d === digits[0])) digits[0] = (digits[0] + 1) % 10
  for (const length of [9, 10]) {
    const sum = digits.reduce((total, d, i) => total + d * (length + 1 - i), 0)
    const rest = (sum * 10) % 11
    digits.push(rest === 10 ? 0 : rest)
  }
  return digits.join('')
}

// Nome só com letras, diferente a cada execução
export function uniqueName(base: string) {
  const letters = 'abcdefghij'
  const suffix = String(Date.now() % 1e6)
    .split('')
    .map((d) => letters[Number(d)])
    .join('')
  return `${base} ${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`
}

// PNG de 1x1 pixel
export const PNG = {
  name: 'rosto.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
}

// Depois de entrar, o app leva para outra página; esperar evita que o próximo passo
// do teste seja atropelado por esse redirecionamento
async function waitLeaveAuth(page: Page) {
  await expect(page).not.toHaveURL(/#\/(entrar|cadastro)/)
}

export async function login(page: Page, email: string, password = 'teste123', { expectSuccess = true } = {}) {
  await page.goto('/#/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel(/^Senha/).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  if (expectSuccess) await waitLeaveAuth(page)
}

export async function signUp(
  page: Page,
  {
    name = 'Ana Lima',
    email = uniqueEmail(),
    password = 'segredo1',
    cpf,
    expectSuccess = true,
  }: { name?: string; email?: string; password?: string; cpf?: string; expectSuccess?: boolean } = {},
) {
  await page.goto('/#/cadastro')
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel(/^Senha/).fill(password)
  await page.getByLabel('Confirmar senha').fill(password)
  if (cpf) {
    await page.getByRole('checkbox', { name: /Também quero oferecer serviços/ }).check()
    await page.getByLabel('CPF').fill(cpf)
    await page.getByRole('button', { name: 'Criar conta de prestador' }).click()
  } else {
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  }
  if (expectSuccess) await waitLeaveAuth(page)
  return { email, password }
}

// A página inteira cabe na largura da tela (sem rolagem para o lado)
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

export async function logout(page: Page) {
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
}

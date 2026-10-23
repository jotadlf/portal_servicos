import { expect, test } from '@playwright/test'
import { login, logout, uniqueName } from './utils.ts'

test.describe('Administração real', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@exemplo.com')
    await expect(page).toHaveURL(/#\/admin/)
  })

  test('novo preço do plano aparece no cadastro', async ({ page }) => {
    await page.getByRole('button', { name: 'Plano e pagamentos' }).click()
    const monthly = page.getByLabel('Mensal (R$)')
    const original = await monthly.inputValue()
    await monthly.fill('29,90')
    await page.getByRole('button', { name: 'Salvar configurações' }).click()
    await expect(page.getByText(/Configurações salvas/)).toBeVisible()

    await logout(page)
    await page.goto('/#/cadastro')
    await page.getByRole('checkbox', { name: /Também quero oferecer serviços/ }).check()
    await expect(page.getByText(/R\$\s29,90 por mês/)).toBeVisible()

    // Volta o valor original para os outros testes
    await login(page, 'admin@exemplo.com')
    await page.getByRole('button', { name: 'Plano e pagamentos' }).click()
    await page.getByLabel('Mensal (R$)').fill(original)
    await page.getByRole('button', { name: 'Salvar configurações' }).click()
    await expect(page.getByText(/Configurações salvas/)).toBeVisible()
  })

  test('modalidade criada aparece no início e some ao remover', async ({ page }) => {
    const name = uniqueName('Vidraceiro')
    await page.getByRole('button', { name: 'Modalidades' }).click()
    await page.getByLabel('Nome').fill(name)
    await page.getByLabel(/Serviços sugeridos/).fill('Trocar vidro de janela')
    await page.getByRole('button', { name: 'Adicionar modalidade' }).click()
    await expect(page.getByText(`${name} já aparece na página inicial.`)).toBeVisible()

    await page.goto('/#/')
    await page.getByRole('button', { name }).click()
    await expect(page.getByRole('button', { name: /Trocar vidro de janela/ })).toBeVisible()

    await page.goto('/#/admin')
    await page.getByRole('button', { name: 'Modalidades' }).click()
    await page.getByRole('button', { name: `Remover ${name}` }).click()
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByRole('button', { name: `Remover ${name}` })).toHaveCount(0)
  })

  test('quem não é admin vê o bloqueio', async ({ page }) => {
    await logout(page)
    await login(page, 'beatriz@exemplo.com')
    await page.goto('/#/admin')
    await expect(page.getByText('Esta área é só para a administração do portal.')).toBeVisible()
  })
})

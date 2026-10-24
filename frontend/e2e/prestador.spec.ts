import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, logout, PNG, randomCpf, signUp, uniqueName } from './utils.ts'

test('prestador do cadastro à busca: serviço, foto, WhatsApp, publicar e aparecer para clientes', async ({ page }) => {
  // Primeiro nome único: o visitante só vê o primeiro nome
  const first = uniqueName('x').split(' ')[1]
  const name = `${first} Souza`
  await signUp(page, { name, cpf: randomCpf() })

  // Cadastro de prestador cai direto em Serviços, com o cartão de publicar bloqueado
  await expect(page).toHaveURL(/#\/servicos/)
  const card = page.getByRole('region', { name: 'Seu perfil ainda não aparece nas buscas' })
  await expect(card.getByRole('button', { name: 'Publicar' })).toBeDisabled()

  await page.getByRole('button', { name: 'Adicionar serviço' }).click()
  await page.getByRole('combobox', { name: /^Profissão/ }).selectOption('chaveiro')
  await page.getByLabel('Serviço', { exact: true }).fill('Abrir porta')
  await page.getByLabel('Preço médio (opcional)').fill('90')
  await page.getByRole('button', { name: 'Salvar', exact: true }).first().click()
  await expect(page.getByText('média R$ 90', { exact: false })).toBeVisible()

  // Perfil: sem foto não salva; com foto e WhatsApp, salva
  await page.goto('/#/conta')
  await page.getByLabel('WhatsApp').fill('62988887777')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByText(/Adicione uma foto/)).toBeVisible()
  await page.getByLabel('Foto do perfil').setInputFiles(PNG)
  await expect(page.getByRole('button', { name: 'Trocar foto' })).toBeVisible()
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByText('Perfil salvo.')).toBeVisible()

  // Publicar
  await page.goto('/#/servicos')
  await card.getByRole('link', { name: 'Publicar' }).click()
  await page.getByRole('radio', { name: /Semestral/ }).check()
  await page.getByRole('button', { name: /grátis e publicar/ }).click()
  await expect(page.getByText(/Perfil publicado\. Plano semestral/)).toBeVisible()

  // Visitante encontra o prestador, só com o primeiro nome e sem preço
  await logout(page)
  await page.getByRole('searchbox', { name: 'Buscar serviço' }).fill('Abrir porta')
  await page.getByRole('button', { name: /Abrir porta/ }).click()
  const sheet = page.locator('dialog')
  await expect(sheet.getByRole('button', { name: new RegExp(`^${first}`) })).toBeVisible()
  await expect(sheet.getByText(name)).toHaveCount(0)
  await expect(sheet.getByText('R$ 90')).toHaveCount(0)
})

test('perfil público de exemplo cabe na tela e esconde preço sem login', async ({ page }) => {
  await page.goto('/#/prestador/p1')
  await expect(page.getByRole('heading', { level: 1, name: 'Carlos' })).toBeVisible()
  await expect(page.getByText('preço visível após entrar').first()).toBeAttached()
  await expectNoHorizontalScroll(page)
})

test('início: busca e lista cabem na tela', async ({ page }) => {
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Eletricista' }).click()
  await page.getByRole('button', { name: 'Exibir' }).click()
  await expect(page.getByRole('button', { name: /Instalar chuveiro/ })).toBeVisible()
  await expectNoHorizontalScroll(page)
})

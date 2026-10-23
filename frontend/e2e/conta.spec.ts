import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, login, signUp, uniqueEmail } from './utils.ts'

test.describe('Cadastro e login reais', () => {
  test('cadastro de quem só contrata: entra e continua na conta ao recarregar', async ({ page }) => {
    const { email, password } = await signUp(page, { name: 'Bruna Alves' })
    await expect(page.getByText(/, Bruna$/)).toBeVisible()

    await page.reload()
    await expect(page.getByText(/, Bruna$/)).toBeVisible()

    // Sai e entra de novo com a senha cadastrada
    await page.getByRole('button', { name: 'Sair' }).click()
    await login(page, email, password)
    await expect(page.getByText(/, Bruna$/)).toBeVisible()
  })

  test('e-mail já cadastrado aparece no campo', async ({ page }) => {
    await signUp(page, { email: 'beatriz@exemplo.com', expectSuccess: false })
    const email = page.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText(/Já existe uma conta com esse e-mail/)).toBeVisible()
  })

  test('senha errada mostra aviso e não entra', async ({ page }) => {
    await login(page, 'carlos@exemplo.com', 'errada', { expectSuccess: false })
    await expect(page.getByText(/E-mail ou senha incorretos/)).toBeVisible()
    await expect(page).toHaveURL(/#\/entrar/)
  })

  test('campos inválidos ganham contorno vermelho e mensagem', async ({ page }) => {
    await page.goto('/#/cadastro')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
    const name = page.getByLabel('Nome')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toBeFocused()
    await expect(name).toHaveCSS('border-top-color', 'rgb(155, 44, 31)')
    await expect(page.getByText('Informe seu nome.')).toBeVisible()
    await expect(page.getByText('Crie uma senha.')).toBeVisible()
  })

  test('mostrar senha', async ({ page }) => {
    await page.goto('/#/entrar')
    const password = page.getByLabel(/^Senha/)
    await password.fill('segredo1')
    await page.getByRole('button', { name: 'Mostrar senha' }).click()
    await expect(password).toHaveAttribute('type', 'text')
  })

  test('dá para entrar só com o teclado', async ({ page, isMobile }) => {
    test.skip(isMobile, 'teclado físico só no computador')
    await page.goto('/#/entrar')
    await page.getByLabel('E-mail').focus()
    await page.keyboard.type('beatriz@exemplo.com')
    await page.keyboard.press('Tab')
    await page.keyboard.type('teste123')
    await page.keyboard.press('Enter')
    await expect(page.getByText(/, Beatriz$/)).toBeVisible()
  })

  test('voltar do navegador depois de entrar não volta para o formulário preenchido', async ({ page }) => {
    await page.goto('/#/prestador/p1')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.getByLabel('E-mail').fill('beatriz@exemplo.com')
    await page.getByLabel(/^Senha/).fill('teste123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Carlos Henrique' })).toBeVisible()
    await page.goBack()
    // Já com sessão, o formulário de login não reaparece
    await expect(page.getByText('Você já está na sua conta, Beatriz.')).toBeVisible()
    await expect(page.getByLabel('E-mail')).toHaveCount(0)
  })

  test('telas de acesso cabem na largura da tela', async ({ page }) => {
    for (const path of ['/#/entrar', '/#/cadastro']) {
      await page.goto(path)
      await expectNoHorizontalScroll(page)
    }
  })
})

test('perfil: dados salvos continuam depois de recarregar', async ({ page }) => {
  await signUp(page, { email: uniqueEmail('perfil') })
  await page.goto('/#/conta')
  await page.getByLabel('WhatsApp').fill('62999998888')
  await page.getByLabel('Bairro').fill('Setor Sul')
  await page.getByLabel('Cidade').fill('Goiânia')
  await page.getByLabel('UF').fill('go')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByText('Perfil salvo.')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('WhatsApp')).toHaveValue('(62) 99999-8888')
  await expect(page.getByLabel('Bairro')).toHaveValue('Setor Sul')
  await expect(page.getByLabel('UF')).toHaveValue('GO')
  await expectNoHorizontalScroll(page)
})

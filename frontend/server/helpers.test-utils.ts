// Ajudantes compartilhados pelos testes da API
import type { TestServer } from './test-server.ts'

// PNG de 1x1 pixel, válido
export const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

let counter = 0
export function uniqueEmail(prefix = 'teste') {
  counter += 1
  return `${prefix}.${counter}.${Date.now()}@exemplo.com`
}

// CPFs válidos (dígitos verificadores certos) para os cadastros de prestador
export const VALID_CPFS = ['52998224725', '11144477735', '12345678909', '39053344705', '71428793860']

export async function signUp(
  server: TestServer,
  data: Partial<{ name: string; email: string; password: string; asProvider: boolean; cpf: string }> = {},
) {
  const response = await server.request('POST', '/api/auth/cadastro', {
    name: 'Ana Lima',
    email: uniqueEmail(),
    password: 'segredo1',
    asProvider: false,
    ...data,
  })
  if (response.status !== 200) throw new Error(`cadastro falhou: ${JSON.stringify(response.body)}`)
  return response.body as { token: string; account: { id: string; professionalId?: string } }
}

export async function signIn(server: TestServer, email: string, password = 'teste123') {
  const response = await server.request('POST', '/api/auth/entrar', { email, password })
  if (response.status !== 200) throw new Error(`login falhou: ${JSON.stringify(response.body)}`)
  return response.body.token as string
}

// Prestador com tudo que a publicação exige: foto, WhatsApp e um serviço
export async function readyProvider(server: TestServer, cpf = VALID_CPFS[0]) {
  const { token, account } = await signUp(server, { asProvider: true, cpf })
  await server.request('POST', '/api/conta/foto', { photo: PNG_1PX }, token)
  await server.request(
    'PATCH',
    '/api/conta',
    { name: 'Ana Lima', phone: '62999998888', address: { neighborhood: 'Setor Oeste' } },
    token,
  )
  await server.request(
    'PUT',
    '/api/prestador/servicos',
    { services: [{ professionId: 'eletricista', name: 'Instalar chuveiro', price: 130 }] },
    token,
  )
  return { token, account }
}

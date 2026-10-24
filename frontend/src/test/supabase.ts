// Os testes de tela falam com o Supabase local de verdade (`supabase start`), pelas mesmas
// funções do app. O setup volta o banco aos dados de exemplo antes de cada teste.
import { exec, row, rows } from '../../banco/ajuda.ts'
import { createAccount, signIn, uploadPhoto, updateAccount } from '../features/conta/usuario'
import { saveServices } from '../features/profissionais/prestadores'

export { closeDb, resetDb, SAMPLE_IDS, todayInBrazil } from '../../banco/ajuda.ts'

// Lê direto do banco, para conferir o que a tela gravou. Parâmetros: $1, $2…
export const dbRow = row
export const dbRows = rows
// Muda o banco direto, para montar a situação do teste
export const dbExec = exec

// Entra numa conta de exemplo (senha teste123) como se fosse pela tela
export function loginAs(email: string, password = 'teste123') {
  return signIn(email, password)
}

let counter = 0
export function uniqueEmail(prefix = 'tela') {
  counter += 1
  return `${prefix}.${counter}.${Date.now()}@exemplo.com`
}

const CPFS = ['52998224725', '11144477735', '12345678909', '39053344705', '71428793860']

// Conta nova já com sessão aberta; prestador ganha CPF válido
export function newAccount({ asProvider = false, cpfIndex = 0 } = {}) {
  return createAccount({
    name: 'Ana Lima',
    email: uniqueEmail(),
    password: 'segredo1',
    asProvider,
    cpf: asProvider ? CPFS[cpfIndex] : undefined,
  })
}

export const PNG_FILE = () =>
  new File(
    [Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))],
    'rosto.png',
    { type: 'image/png' },
  )

// Prestador com foto, WhatsApp e um serviço: pronto para publicar
export async function readyProvider() {
  await newAccount({ asProvider: true })
  await uploadPhoto(PNG_FILE())
  await updateAccount({
    name: 'Ana Lima',
    phone: '62999998888',
    address: { cep: '', street: '', number: '', complement: '', neighborhood: 'Setor Oeste', city: '', state: '' },
  })
  await saveServices([{ professionId: 'eletricista', name: 'Instalar ventilador', price: 120, unit: 'servico' }])
  const { currentAccount } = await import('../features/conta/usuario')
  return (await currentAccount())!
}

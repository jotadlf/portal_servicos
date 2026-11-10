// Quem responde pelos dados do portal (controlador, LGPD art. 5º, VI). Aparece na política de
// privacidade e na página de contato.
export const CONTROLLER = {
  name: 'Bruna de Sousa Neto',
  city: 'Jataí/GO',
  email: 'bruna@gmail.com',
}

// Versões da política e dos termos, aceitas no cadastro. Ao mudar um texto, mude a versão e a data
// dele aqui e interno.versao_privacidade() ou interno.versao_termos() numa migração nova: o banco
// só aceita cadastro com as versões atuais.
export const PRIVACY_VERSION = '2026-11-10'
export const PRIVACY_UPDATED_AT = '10/11/2026'
export const TERMS_VERSION = '2026-11-10'
export const TERMS_UPDATED_AT = '10/11/2026'

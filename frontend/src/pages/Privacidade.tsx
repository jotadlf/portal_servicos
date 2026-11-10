// Política de privacidade, curta e sem citar leis (cobre o que a LGPD art. 9º pede: controlador,
// contato, dados e finalidades, compartilhamento, transferência ao exterior, prazo e direitos).
// Ao mudar um dado coletado, um fornecedor ou o prazo de guarda, mude este texto e a versão.
import { BottomMenu } from '../components/BottomMenu'
import { PageBar } from '../components/PageBar'
import type { Account } from '../features/conta/usuario'
import { routes } from '../hooks/useHashRoute'
import { CONTROLLER, PRIVACY_UPDATED_AT } from '../lib/controlador'
import { Section } from './Termos'

const DATA = [
  ['Nome, e-mail e senha', 'Para criar a sua conta e você entrar. A senha fica cifrada; ninguém a vê.'],
  ['WhatsApp', 'Para os clientes falarem com quem oferece serviços.'],
  ['Endereço (opcional)', 'Só o bairro aparece para outras pessoas.'],
  ['Foto', 'Aparece no seu perfil. É obrigatória para quem oferece serviços.'],
  [
    'CPF e data de nascimento',
    'Só de quem oferece serviços, para confirmar que tem 18 anos ou mais e evitar contas repetidas. Não aparecem para ninguém.',
  ],
  ['Serviços, preços e "Sobre"', 'Formam o perfil público de quem oferece serviços.'],
  ['Contatos pelo WhatsApp', 'O prestador vê o nome, o bairro e o serviço de quem o procurou.'],
  ['Avaliações', 'Aparecem no perfil do prestador com o seu primeiro nome.'],
  ['Aceite dos termos e desta política', 'A versão e a data em que você aceitou.'],
  ['Pedidos sobre seus dados', 'Para atender o que você pediu.'],
]

const PROCESSORS = [
  ['Supabase', 'Guarda o banco de dados, o login e as fotos, em servidores nos Estados Unidos.'],
  ['GitHub Pages', 'Entrega os arquivos do site.'],
  ['ViaCEP', 'Recebe só o CEP que você digita, para preencher o endereço.'],
  ['WhatsApp', 'Ao abrir uma conversa, você sai do portal e vale a política do WhatsApp.'],
]

export function Privacidade({ account }: { account?: Account }) {
  const contato = <a href={routes.contato}>página de contato</a>

  return (
    <div className="app">
      <PageBar title="Privacidade" />
      <main className="page policy">
        <header className="page-section">
          <h1 className="page-title">Política de privacidade</h1>
          <p className="section-note">Atualizada em {PRIVACY_UPDATED_AT}.</p>
        </header>

        <Section id="quem" title="Quem cuida dos seus dados">
          <p>
            {CONTROLLER.name}, de {CONTROLLER.city}. Fale pela {contato} ou por{' '}
            <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>.
          </p>
        </Section>

        <Section id="quais" title="O que guardamos e para quê">
          <ul className="policy-list">
            {DATA.map(([data, purpose]) => (
              <li key={data}>
                <strong>{data}</strong>
                <span>{purpose}</span>
              </li>
            ))}
          </ul>
          <p>
            Usamos os dados só para o portal funcionar, cumprir o que você contratou e evitar fraudes.
          </p>
        </Section>

        <Section id="quem-ve" title="Quem vê o quê">
          <ul>
            <li>
              Qualquer pessoa vê o primeiro nome, o bairro, os serviços, a nota e as avaliações de quem
              oferece serviços.
            </li>
            <li>Quem entra no portal vê também o nome completo, a foto, os preços e o WhatsApp.</li>
            <li>CPF, data de nascimento, senha e endereço completo não aparecem para ninguém.</li>
            <li>Não vendemos seus dados, não fazemos publicidade com eles e não usamos inteligência artificial.</li>
          </ul>
        </Section>

        <Section id="fornecedores" title="Empresas que nos ajudam">
          <ul className="policy-list">
            {PROCESSORS.map(([name, what]) => (
              <li key={name}>
                <strong>{name}</strong>
                <span>{what}</span>
              </li>
            ))}
          </ul>
          <p>
            Ainda não há cobranças. Quando houver, diremos aqui qual empresa de pagamento é usada. Os dados
            do cartão nunca passam pelo portal.
          </p>
        </Section>

        <Section id="aparelho" title="No seu aparelho">
          <p>
            Não usamos cookies de rastreamento. A sessão fica guardada só na aba aberta do navegador e
            some quando ela é fechada.
          </p>
        </Section>

        <Section id="prazo" title="Por quanto tempo">
          <p>
            Enquanto a sua conta existir. O botão "Apagar conta", no <a href={routes.conta}>Perfil</a>, apaga
            na hora a conta e tudo o que está nela.
          </p>
        </Section>

        <Section id="direitos" title="Seus direitos">
          <p>
            Você pode ver, corrigir, levar para outro serviço ou apagar os seus dados, saber com quem os
            compartilhamos e retirar uma autorização que tenha dado. Para uma cópia, use "Baixar meus dados"
            no <a href={routes.conta}>Perfil</a>; para o resto, peça pela {contato}. Respondemos em até 15 dias. Você também pode reclamar na Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Section>

        <Section id="seguranca" title="Segurança">
          <p>
            Cada pessoa só vê e muda o que é dela, a conexão é sempre cifrada e a senha também. Se houver
            um incidente que ponha você em risco, avisamos você e a ANPD.
          </p>
        </Section>

        <Section id="mudancas" title="Mudanças">
          <p>Quando esta política mudar, a data no topo muda e avisamos no portal.</p>
        </Section>
      </main>

      <BottomMenu current="conta" showAdmin={account?.isAdmin} />
    </div>
  )
}

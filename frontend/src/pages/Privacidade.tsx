// Política de privacidade (LGPD art. 9º). Reflete o que o código guarda e compartilha:
// ao mudar um dado coletado, um fornecedor ou o prazo de guarda, mude este texto e a data.
import { BottomMenu } from '../components/BottomMenu'
import { PageBar } from '../components/PageBar'
import type { Account } from '../features/conta/usuario'
import { routes } from '../hooks/useHashRoute'
import { CONTROLLER, PRIVACY_UPDATED_AT } from '../lib/controlador'

type DataRow = { data: string; when: string; purpose: string; basis: string }

const DATA: DataRow[] = [
  {
    data: 'Nome, e-mail e senha',
    when: 'Ao criar a conta',
    purpose: 'Criar sua conta e deixar você entrar. A senha é guardada cifrada; ninguém a vê.',
    basis: 'Execução de contrato (art. 7º, V)',
  },
  {
    data: 'WhatsApp',
    when: 'Quando você informa no perfil',
    purpose: 'Para quem oferece serviços: os clientes falam com você por ele.',
    basis: 'Execução de contrato (art. 7º, V)',
  },
  {
    data: 'Endereço (CEP, rua, número, complemento, bairro, cidade, UF)',
    when: 'Quando você informa no perfil (opcional)',
    purpose: 'Mostrar o bairro de quem oferece serviços e de quem pede contato. O resto do endereço não aparece para ninguém.',
    basis: 'Execução de contrato (art. 7º, V)',
  },
  {
    data: 'Foto',
    when: 'Quando você envia (obrigatória para quem oferece serviços)',
    purpose: 'Aparecer no seu perfil.',
    basis: 'Execução de contrato (art. 7º, V)',
  },
  {
    data: 'CPF',
    when: 'Só de quem oferece serviços',
    purpose: 'Identificar quem oferece serviços e impedir que a mesma pessoa tenha várias contas de prestador. Não aparece para ninguém.',
    basis: 'Execução de contrato (art. 7º, V) e prevenção a fraudes (legítimo interesse, art. 7º, IX)',
  },
  {
    data: 'Data de nascimento',
    when: 'Só de quem oferece serviços',
    purpose: 'Confirmar que você tem 18 anos ou mais para contratar o plano. Não aparece para ninguém.',
    basis: 'Execução de contrato (art. 7º, V)',
  },
  {
    data: 'Serviços, preços e texto "Sobre"',
    when: 'Quando você cadastra seus serviços',
    purpose: 'Montar o seu perfil público de prestador.',
    basis: 'Execução de contrato (art. 7º, V)',
  },
  {
    data: 'Contatos pelo WhatsApp',
    when: 'Quando você confirma "Abrir conversa" no perfil de alguém',
    purpose: 'Mostrar ao prestador quem procurou por ele (seu nome, seu bairro e o serviço) e liberar a avaliação.',
    basis: 'Execução de contrato (art. 7º, V)',
  },
  {
    data: 'Avaliações (nota e comentário)',
    when: 'Quando você avalia um prestador',
    purpose: 'Mostrar a nota do prestador. No perfil público aparece só o seu primeiro nome.',
    basis: 'Legítimo interesse (art. 7º, IX): ajudar outras pessoas a escolher',
  },
  {
    data: 'Pedidos sobre seus dados',
    when: 'Quando você envia um pedido na página de contato',
    purpose: 'Atender os seus direitos de titular.',
    basis: 'Cumprimento de obrigação legal (art. 7º, II)',
  },
]

const PROCESSORS = [
  {
    name: 'Supabase',
    what: 'Guarda o banco de dados, as fotos e o login. Os servidores ficam nos Estados Unidos.',
  },
  {
    name: 'GitHub Pages',
    what: 'Entrega os arquivos do site. Recebe o endereço IP de quem abre o site, como todo servidor de páginas.',
  },
  {
    name: 'ViaCEP',
    what: 'Recebe só o CEP que você digita no perfil, para preencher a rua, o bairro e a cidade.',
  },
  {
    name: 'WhatsApp (Meta)',
    what: 'Quando você abre uma conversa, sai do portal e passa a valer a política do WhatsApp.',
  },
]

const RIGHTS = [
  'Saber se tratamos seus dados e ter acesso a eles',
  'Corrigir dados incompletos, errados ou desatualizados',
  'Pedir que dados desnecessários ou tratados em desacordo com a lei sejam anonimizados, bloqueados ou apagados',
  'Levar seus dados para outro serviço (portabilidade)',
  'Apagar os dados tratados com base no seu consentimento',
  'Saber com quem compartilhamos seus dados',
  'Revogar um consentimento que você tenha dado',
  'Se opor a um tratamento feito em desacordo com a lei',
]

export function Privacidade({ account }: { account?: Account }) {
  return (
    <div className="app">
      <PageBar title="Privacidade" />
      <main className="page policy">
        <header className="page-section">
          <h1 className="page-title">Política de privacidade</h1>
          <p className="section-note">Atualizada em {PRIVACY_UPDATED_AT}.</p>
        </header>

        <section className="page-section" aria-labelledby="quem">
          <h2 id="quem">Quem cuida dos seus dados</h2>
          <p>
            O Portal de Serviços é mantido por {CONTROLLER.name}, de {CONTROLLER.city}, que decide como os seus
            dados são usados (o controlador, pela Lei Geral de Proteção de Dados, Lei 13.709/2018).
          </p>
          <p>
            Para qualquer assunto sobre os seus dados, use a{' '}
            <a href={routes.contato}>página de contato</a> ou escreva para{' '}
            <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>.
          </p>
        </section>

        <section className="page-section" aria-labelledby="quais">
          <h2 id="quais">Quais dados guardamos e por quê</h2>
          <ul className="policy-list">
            {DATA.map((row) => (
              <li key={row.data}>
                <strong>{row.data}</strong>
                <dl>
                  <dt>Quando</dt>
                  <dd>{row.when}</dd>
                  <dt>Para quê</dt>
                  <dd>{row.purpose}</dd>
                  <dt>Base legal</dt>
                  <dd>{row.basis}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </section>

        <section className="page-section" aria-labelledby="quem-ve">
          <h2 id="quem-ve">Quem vê o quê</h2>
          <ul>
            <li>
              Sem entrar no portal, qualquer pessoa vê o primeiro nome, o bairro, os serviços, a nota e
              as avaliações de quem oferece serviços. Cada avaliação mostra só o primeiro nome de quem
              avaliou.
            </li>
            <li>Quem entra vê também o nome completo, a foto, os preços e o WhatsApp do prestador.</li>
            <li>O prestador vê o nome e o bairro de quem pediu contato com ele.</li>
            <li>A administração do portal vê os pedidos enviados na página de contato, com nome e e-mail.</li>
            <li>CPF, data de nascimento, senha e endereço completo não aparecem para ninguém.</li>
          </ul>
          <p>Não vendemos seus dados e não usamos seus dados para publicidade.</p>
        </section>

        <section className="page-section" aria-labelledby="fornecedores">
          <h2 id="fornecedores">Empresas que tratam dados para nós</h2>
          <ul className="policy-list">
            {PROCESSORS.map(({ name, what }) => (
              <li key={name}>
                <strong>{name}</strong>
                <p>{what}</p>
              </li>
            ))}
          </ul>
          <p>
            Ainda não fazemos cobranças pelo portal. Quando começarmos, esta política vai dizer qual
            empresa de pagamento recebe os seus dados. Os dados do cartão nunca vão passar pelo portal.
          </p>
        </section>

        <section className="page-section" aria-labelledby="exterior">
          <h2 id="exterior">Dados guardados fora do Brasil</h2>
          <p>
            O banco de dados fica em servidores da Supabase nos Estados Unidos. A transferência é feita
            para executar o serviço que você contratou (LGPD art. 33) e com as garantias de proteção
            previstas no contrato com a Supabase.
          </p>
        </section>

        <section className="page-section" aria-labelledby="cookies">
          <h2 id="cookies">Cookies e armazenamento no aparelho</h2>
          <p>
            O portal não usa cookies de publicidade nem ferramentas de rastreamento. Para manter você
            conectado, a sessão fica guardada no navegador, só na aba aberta, e some quando ela é
            fechada. Isso é necessário para o portal funcionar e não depende de consentimento.
          </p>
        </section>

        <section className="page-section" aria-labelledby="prazo">
          <h2 id="prazo">Por quanto tempo guardamos</h2>
          <p>
            Enquanto a sua conta existir. Em <a href={routes.conta}>Perfil</a>, o botão "Apagar conta"
            apaga na hora a conta, a foto, o perfil de prestador, os serviços, os contatos, as
            avaliações que você deu e recebeu, e os seus pedidos. Se houver cópias de segurança na
            Supabase, elas são substituídas com o tempo.
          </p>
        </section>

        <section className="page-section" aria-labelledby="direitos">
          <h2 id="direitos">Seus direitos</h2>
          <p>Pela LGPD (art. 18), você pode:</p>
          <ul>
            {RIGHTS.map((right) => (
              <li key={right}>{right}</li>
            ))}
          </ul>
          <p>
            Faça o pedido na <a href={routes.contato}>página de contato</a>. Respondemos em até 15 dias
            (art. 19, II). Você também pode reclamar na Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
          <p>
            CPF e data de nascimento não podem ser trocados pelo próprio app, para que ninguém se cadastre
            com um CPF e passe a usar outro. Se estiverem errados, peça a correção pela página de contato.
          </p>
        </section>

        <section className="page-section" aria-labelledby="seguranca">
          <h2 id="seguranca">Segurança</h2>
          <p>
            Todo o acesso ao banco passa por regras que só deixam cada pessoa ver e mudar o que é dela. A
            conexão é sempre cifrada (HTTPS) e a senha é guardada cifrada. Se acontecer um incidente que
            possa causar risco ou dano relevante, avisamos você e a ANPD.
          </p>
        </section>

        <section className="page-section" aria-labelledby="menores">
          <h2 id="menores">Menores de idade</h2>
          <p>
            O portal não é voltado a menores de 18 anos. Para oferecer serviços é preciso ter 18 anos ou
            mais.
          </p>
        </section>

        <section className="page-section" aria-labelledby="automatizadas">
          <h2 id="automatizadas">Decisões automáticas</h2>
          <p>
            Não usamos inteligência artificial com os seus dados nem tomamos decisões automáticas sobre
            você. A ordem dos prestadores na busca segue a nota e o número de avaliações, ou a ordem que
            você escolher.
          </p>
        </section>

        <section className="page-section" aria-labelledby="mudancas">
          <h2 id="mudancas">Mudanças nesta política</h2>
          <p>
            Quando esta política mudar, a data no topo muda junto. Mudanças importantes serão avisadas no
            portal.
          </p>
        </section>
      </main>

      <BottomMenu current="conta" showAdmin={account?.isAdmin} />
    </div>
  )
}

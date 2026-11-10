// Termos de uso, curtos e sem citar leis. Os direitos do consumidor (arrependimento em 7 dias,
// CDC art. 49; foro do consumidor, CDC art. 101, I) aparecem como regra, sem o artigo.
// Ao mudar o plano, a cobrança, o cadastro ou as regras, mude este texto e a versão.
import type { ReactNode } from 'react'
import { BottomMenu } from '../components/BottomMenu'
import { PageBar } from '../components/PageBar'
import type { Account } from '../features/conta/usuario'
import { routes } from '../hooks/useHashRoute'
import { CONTROLLER, TERMS_UPDATED_AT } from '../lib/controlador'

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="page-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

export function Termos({ account }: { account?: Account }) {
  const contato = <a href={routes.contato}>página de contato</a>

  return (
    <div className="app">
      <PageBar title="Termos de uso" />
      <main className="page policy">
        <header className="page-section">
          <h1 className="page-title">Termos de uso</h1>
          <p className="section-note">Atualizados em {TERMS_UPDATED_AT}.</p>
          <p>Ao criar a conta, você aceita estes termos. Se não concordar, não use o portal.</p>
        </header>

        <Section id="quem" title="Quem somos">
          <p>
            O Portal de Serviços é mantido por {CONTROLLER.name}, de {CONTROLLER.city}. Fale pela {contato}{' '}
            ou por <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>.
          </p>
        </Section>

        <Section id="o-que-e" title="O que o portal faz">
          <ul>
            <li>Mostra quem oferece serviços na sua região e leva você para conversar pelo WhatsApp.</li>
            <li>
              Não presta os serviços e não recebe o pagamento deles. Preço, prazo e garantia são combinados
              entre você e o prestador.
            </li>
            <li>Os preços do perfil são médios e informados pelo prestador.</li>
            <li>Quem responde pelo serviço é o prestador, sem tirar os seus direitos de consumidor.</li>
          </ul>
        </Section>

        <Section id="conta" title="Sua conta">
          <ul>
            <li>O portal é para maiores de 18 anos.</li>
            <li>Use dados verdadeiros e não compartilhe a sua senha.</li>
            <li>
              Você pode apagar a conta quando quiser, no <a href={routes.conta}>Perfil</a>.
            </li>
          </ul>
        </Section>

        <Section id="prestador" title="Para quem oferece serviços">
          <ul>
            <li>
              Informe CPF e data de nascimento. Cada CPF tem uma conta de prestador, e esses dados só mudam
              por pedido na {contato}.
            </li>
            <li>Ofereça só o que você faz, com as habilitações exigidas, e preços médios reais.</li>
            <li>Use os dados de quem procurou você só para atender essa pessoa.</li>
          </ul>
        </Section>

        <Section id="plano" title="Plano e cancelamento">
          <ul>
            <li>
              O preço, o período grátis e a data da primeira cobrança aparecem antes de publicar. O período
              grátis começa quando você publica.
            </li>
            <li>Cancelando antes do fim do período grátis, você não paga nada.</li>
            <li>Depois, o plano se renova todo mês ou a cada 6 meses, até você cancelar.</li>
            <li>A cobrança ainda não está ativa. Avisaremos por e-mail antes da primeira.</li>
            <li>
              Para cancelar, peça pela {contato} ou apague a conta. Vale na hora, com confirmação por e-mail.
            </li>
            <li>Até 7 dias depois de uma cobrança, você pode desistir e receber o valor de volta.</li>
            <li>Mudanças de preço só valem na renovação seguinte, com aviso antes.</li>
          </ul>
        </Section>

        <Section id="conduta" title="Não é permitido">
          <ul>
            <li>Usar nome, foto ou dados de outra pessoa.</li>
            <li>Oferecer serviço ilegal ou que você não presta.</li>
            <li>Publicar conteúdo ofensivo, discriminatório ou enganoso.</li>
            <li>Avaliar sem ter sido atendido, avaliar a si mesmo ou pagar por avaliações.</li>
            <li>Mandar propaganda para quem você conheceu pelo portal.</li>
            <li>Tentar acessar dados de outras pessoas ou atrapalhar o portal.</li>
          </ul>
          <p>
            Viu algo assim? Avise pela {contato}. Podemos remover o conteúdo e suspender ou encerrar a conta,
            avisando antes sempre que possível.
          </p>
        </Section>

        <Section id="conteudo" title="O que você publica">
          <p>
            Fotos, textos e avaliações continuam seus. Você permite que o portal os mostre enquanto estiverem
            publicados.
          </p>
        </Section>

        <Section id="funcionamento" title="Funcionamento">
          <p>
            O portal pode ficar fora do ar por manutenção ou falhas. Mudanças que afetem o seu plano são
            avisadas antes.
          </p>
        </Section>

        <Section id="mudancas" title="Mudanças nestes termos">
          <p>
            A data no topo muda e avisamos no portal e por e-mail. Se não concordar, você pode cancelar e
            apagar a conta.
          </p>
        </Section>

        <Section id="foro" title="Disputas">
          <p>Se precisar ir à Justiça, você pode fazer isso na cidade onde mora.</p>
        </Section>

        <p className="section-note">
          Como usamos os seus dados está na <a href={routes.privacidade}>política de privacidade</a>.
        </p>
      </main>

      <BottomMenu current="conta" showAdmin={account?.isAdmin} />
    </div>
  )
}

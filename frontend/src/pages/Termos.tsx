// Termos de uso. Refletem como o portal funciona hoje: ao mudar o plano, a cobrança, o
// cadastro ou as regras, mude este texto, TERMS_VERSION e interno.versao_termos().
import type { ReactNode } from 'react'
import { BottomMenu } from '../components/BottomMenu'
import { PageBar } from '../components/PageBar'
import type { Account } from '../features/conta/usuario'
import { routes } from '../hooks/useHashRoute'
import { CONTROLLER, TERMS_UPDATED_AT } from '../lib/controlador'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="page-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

export function Termos({ account }: { account?: Account }) {
  const email = <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>
  const contato = <a href={routes.contato}>página de contato</a>

  return (
    <div className="app">
      <PageBar title="Termos de uso" />
      <main className="page policy">
        <header className="page-section">
          <h1 className="page-title">Termos de uso</h1>
          <p className="section-note">Atualizados em {TERMS_UPDATED_AT}.</p>
          <p>
            Estes termos valem para quem usa o Portal de Serviços, para contratar ou para oferecer
            serviços. Ao criar a conta, você declara que leu e aceita estes termos. Se não concordar, não
            use o portal.
          </p>
        </header>

        <Section id="quem" title="Quem somos">
          <p>
            O Portal de Serviços é mantido por {CONTROLLER.name}, de {CONTROLLER.city}. Contato: {email}{' '}
            ou a {contato}.
          </p>
        </Section>

        <Section id="o-que-e" title="O que o portal faz e o que não faz">
          <ul>
            <li>
              O portal é uma vitrine: mostra quem oferece serviços na sua região, com os serviços, os
              preços médios e as avaliações, e leva você para conversar com o prestador pelo WhatsApp.
            </li>
            <li>
              O portal não presta os serviços, não participa da conversa nem do acordo entre cliente e
              prestador e não recebe o pagamento pelo serviço. Preço, prazo, garantia e forma de pagamento
              são combinados diretamente entre vocês.
            </li>
            <li>
              Os preços do perfil são médios e informados pelo prestador. O valor final é o combinado na
              conversa.
            </li>
            <li>
              Quem responde pelo serviço prestado é o prestador. Isso não tira nenhum direito que o Código
              de Defesa do Consumidor garante a você.
            </li>
          </ul>
        </Section>

        <Section id="conta" title="Sua conta">
          <ul>
            <li>O portal é para maiores de 18 anos.</li>
            <li>Informe dados verdadeiros e mantenha o seu perfil atualizado.</li>
            <li>
              A conta é pessoal. Guarde a sua senha e não a compartilhe. Se achar que alguém entrou na
              sua conta, troque a senha e avise pela {contato}.
            </li>
            <li>
              Você pode apagar a conta a qualquer momento em <a href={routes.conta}>Perfil</a>, no botão
              "Apagar conta".
            </li>
          </ul>
        </Section>

        <Section id="prestador" title="Para quem oferece serviços">
          <ul>
            <li>
              É preciso ter 18 anos ou mais e informar CPF e data de nascimento. Cada CPF pode ter uma
              conta de prestador. CPF e data de nascimento não podem ser trocados pelo app; se estiverem
              errados, peça a correção pela {contato}.
            </li>
            <li>
              Para aparecer na busca, o perfil precisa de foto, WhatsApp e pelo menos um serviço. Ao
              publicar, você confirma que oferece os serviços cadastrados, que tem as habilitações exigidas
              por lei para eles e que os preços médios são reais.
            </li>
            <li>
              Os dados de quem pede contato (nome, bairro e serviço) servem só para atender aquele cliente.
              Não use para outra finalidade, como enviar propaganda.
            </li>
          </ul>
        </Section>

        <Section id="plano" title="Plano, período grátis e cancelamento">
          <ul>
            <li>
              Oferecer serviços exige um plano, mensal ou semestral. O preço, o período grátis e a data da
              primeira cobrança aparecem na tela antes de publicar. O período grátis começa a contar quando
              você publica.
            </li>
            <li>
              Se você cancelar antes do fim do período grátis, não paga nada. Depois dele, o plano se renova
              a cada mês ou a cada seis meses, pela forma de pagamento escolhida, até você cancelar.
            </li>
            <li>
              A cobrança automática ainda não está ativa: enquanto não estiver, nada é cobrado. Antes da
              primeira cobrança, avisaremos por e-mail com antecedência, com o valor e a data.
            </li>
            <li>
              Para cancelar, faça o pedido pela {contato} ou apague a sua conta. O cancelamento vale a
              partir do pedido, e você recebe a confirmação por e-mail.
            </li>
            <li>
              Você pode desistir em até 7 dias depois de qualquer cobrança e receber de volta o valor
              pago, sem precisar explicar o motivo (Código de Defesa do Consumidor, art. 49).
            </li>
            <li>
              Mudanças de preço valem só a partir da renovação seguinte e serão avisadas antes por e-mail.
            </li>
          </ul>
        </Section>

        <Section id="conduta" title="O que não é permitido">
          <ul>
            <li>Usar nome, foto, CPF ou dados de outra pessoa.</li>
            <li>Oferecer serviço ilegal ou que você não presta.</li>
            <li>Publicar texto ofensivo, discriminatório, enganoso ou que viole direitos de outras pessoas.</li>
            <li>Fazer avaliações falsas, avaliar a si mesmo ou pagar por avaliações.</li>
            <li>Enviar propaganda ou mensagens em massa para quem você conheceu pelo portal.</li>
            <li>Tentar acessar dados de outras pessoas ou atrapalhar o funcionamento do portal.</li>
          </ul>
        </Section>

        <Section id="avaliacoes" title="Avaliações">
          <p>
            Só avalia um prestador quem falou com ele pelo portal. A avaliação precisa contar a sua
            experiência de verdade. Cada pessoa tem uma avaliação por prestador e pode refazê-la. No
            perfil público aparece só o primeiro nome de quem avaliou.
          </p>
        </Section>

        <Section id="denuncias" title="Denúncias e remoção de conteúdo">
          <p>
            Se encontrar um perfil, um serviço ou uma avaliação que desrespeite estes termos ou a lei,
            avise pela {contato} ou por {email}. Podemos remover o conteúdo e, nos casos graves ou
            repetidos, suspender ou encerrar a conta. Sempre que possível, avisamos a pessoa antes e
            explicamos o motivo.
          </p>
        </Section>

        <Section id="conteudo" title="O que você publica">
          <p>
            Fotos, textos, serviços e avaliações continuam sendo seus. Ao publicar, você permite que o
            portal os mostre para os outros usuários enquanto estiverem no portal. Ao apagar o conteúdo ou
            a conta, eles deixam de aparecer.
          </p>
        </Section>

        <Section id="disponibilidade" title="Funcionamento do portal">
          <p>
            Trabalhamos para manter o portal no ar e seguro, mas ele pode ficar fora do ar por manutenção
            ou por falhas de fornecedores. Podemos mudar ou retirar funções; mudanças que afetem o plano
            contratado serão avisadas antes por e-mail.
          </p>
        </Section>

        <Section id="privacidade" title="Seus dados">
          <p>
            Como usamos os seus dados está na <a href={routes.privacidade}>política de privacidade</a>.
          </p>
        </Section>

        <Section id="mudancas" title="Mudanças nestes termos">
          <p>
            Quando os termos mudarem, a data no topo muda junto. Mudanças importantes serão avisadas no
            portal e por e-mail antes de valer. Se não concordar com a nova versão, você pode cancelar o
            plano e apagar a conta.
          </p>
        </Section>

        <Section id="lei" title="Lei e foro">
          <p>
            Estes termos seguem a lei brasileira. Se precisar ir à Justiça, você pode fazer isso na cidade
            onde mora (Código de Defesa do Consumidor, art. 101, I).
          </p>
        </Section>
      </main>

      <BottomMenu current="conta" showAdmin={account?.isAdmin} />
    </div>
  )
}

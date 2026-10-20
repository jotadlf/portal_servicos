import { useRef, useState, type FormEvent } from 'react'

type Service = {
  id: string
  name: string
  // Nome com artigo, para encaixar na frase "Preciso de ..."
  withArticle: string
  examples: string
  // Exemplo de tarefa mostrado no campo "para ..."
  taskHint: string
}

const services: Service[] = [
  {
    id: 'diarista',
    name: 'Diarista',
    withArticle: 'uma diarista',
    examples: 'Limpeza geral, faxina pós-obra, passar roupa',
    taskHint: 'uma faxina completa no apartamento',
  },
  {
    id: 'encanador',
    name: 'Encanador',
    withArticle: 'um encanador',
    examples: 'Vazamento, troca de torneira, desentupimento',
    taskHint: 'trocar o sifão da pia',
  },
  {
    id: 'eletricista',
    name: 'Eletricista',
    withArticle: 'um eletricista',
    examples: 'Tomada, chuveiro, quadro de energia',
    taskHint: 'instalar um chuveiro novo',
  },
  {
    id: 'pedreiro',
    name: 'Pedreiro',
    withArticle: 'um pedreiro',
    examples: 'Reboco, assentamento de piso, pequenas reformas',
    taskHint: 'trocar o piso da cozinha',
  },
  {
    id: 'pintor',
    name: 'Pintor',
    withArticle: 'um pintor',
    examples: 'Paredes, portões, textura e grafiato',
    taskHint: 'pintar a sala e um quarto',
  },
  {
    id: 'montador',
    name: 'Montador de móveis',
    withArticle: 'um montador de móveis',
    examples: 'Guarda-roupa, cozinha planejada, painel de TV',
    taskHint: 'montar um guarda-roupa',
  },
  {
    id: 'jardineiro',
    name: 'Jardineiro',
    withArticle: 'um jardineiro',
    examples: 'Poda, plantio de grama, limpeza de lote',
    taskHint: 'podar as árvores do quintal',
  },
  {
    id: 'chaveiro',
    name: 'Chaveiro',
    withArticle: 'um chaveiro',
    examples: 'Cópia de chave, abertura de porta, troca de fechadura',
    taskHint: 'trocar a fechadura da porta',
  },
]

const steps = [
  {
    title: 'Descreva o serviço',
    text: 'Diga o que precisa ser feito e em qual bairro.',
  },
  {
    title: 'Receba orçamentos',
    text: 'Profissionais da região respondem com o preço.',
  },
  {
    title: 'Escolha e combine',
    text: 'Compare os orçamentos e combine o dia com quem você escolher.',
  },
]

function App() {
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [task, setTask] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [error, setError] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)

  const pickerRef = useRef<HTMLFieldSetElement>(null)
  const taskRef = useRef<HTMLInputElement>(null)
  const neighborhoodRef = useRef<HTMLInputElement>(null)

  const service = services.find(({ id }) => id === serviceId)
  const taskHint = service?.taskHint ?? 'trocar o sifão da pia'

  function chooseService(id: string) {
    setServiceId(id)
    setIsReviewing(false)
    setError('')
  }

  function requestFromList(id: string) {
    chooseService(id)
    document.getElementById('pedido')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    taskRef.current?.focus({ preventScroll: true })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!service) {
      setError('Escolha o serviço que você precisa.')
      pickerRef.current?.querySelector('input')?.focus()
      return
    }
    if (!task.trim()) {
      setError('Conte o que precisa ser feito.')
      taskRef.current?.focus()
      return
    }
    if (!neighborhood.trim()) {
      setError('Informe o bairro onde será o serviço.')
      neighborhoodRef.current?.focus()
      return
    }

    setError('')
    // TODO: gravar o pedido no Supabase quando a tabela de pedidos existir.
    setIsReviewing(true)
  }

  return (
    <div className="page">
      <a className="skip-link" href="#pedido">
        Ir para o pedido
      </a>

      <header className="topbar">
        <a className="wordmark" href="#pedido">
          Portal de Serviços
        </a>
        <nav aria-label="Navegação principal">
          <a href="#servicos">Serviços</a>
          <a href="#como-funciona">Como funciona</a>
        </nav>
      </header>

      <main>
        <section id="pedido" className="request" aria-labelledby="pedido-titulo">
          <h1 id="pedido-titulo" className="visually-hidden">
            Peça orçamentos para serviços na sua casa
          </h1>

          <form noValidate onSubmit={handleSubmit}>
            <p className="sentence">
              Preciso de{' '}
              <button
                type="button"
                className={`slot slot-button${service ? ' is-filled' : ''}`}
                onClick={() => pickerRef.current?.querySelector('input')?.focus()}
              >
                {service ? service.withArticle : 'alguém'}
              </button>{' '}
              para{' '}
              <span
                className="slot slot-task"
                data-value={task || taskHint}
                data-empty={!task || undefined}
              >
                <input
                  ref={taskRef}
                  size={1}
                  aria-label="O que precisa ser feito"
                  placeholder={taskHint}
                  maxLength={80}
                  value={task}
                  onChange={(event) => {
                    setTask(event.currentTarget.value)
                    setIsReviewing(false)
                  }}
                />
              </span>{' '}
              no bairro{' '}
              <span className="nowrap">
                <span
                  className="slot slot-place"
                  data-value={neighborhood || 'Setor Bueno'}
                  data-empty={!neighborhood || undefined}
                >
                  <input
                    ref={neighborhoodRef}
                    size={1}
                    aria-label="Bairro"
                    placeholder="Setor Bueno"
                    maxLength={50}
                    autoComplete="address-level3"
                    value={neighborhood}
                    onChange={(event) => {
                      setNeighborhood(event.currentTarget.value)
                      setIsReviewing(false)
                    }}
                  />
                </span>
                .
              </span>
            </p>

            <fieldset ref={pickerRef} className="picker">
              <legend>Escolha o serviço</legend>
              <div className="picker-options">
                {services.map(({ id, name }) => (
                  <label key={id} className="chip">
                    <input
                      type="radio"
                      name="servico"
                      value={id}
                      checked={serviceId === id}
                      onChange={() => chooseService(id)}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="request-actions">
              <button type="submit" className="primary">
                Pedir orçamentos
              </button>
              <p className="request-note">
                Profissionais da sua região respondem com o preço. Você escolhe se quer contratar.
              </p>
            </div>

            <div aria-live="polite">
              {error && <p className="request-error">{error}</p>}
              {isReviewing && service && (
                <div className="review">
                  <p className="review-title">Seu pedido está pronto</p>
                  <dl>
                    <div>
                      <dt>Serviço</dt>
                      <dd>{service.name}</dd>
                    </div>
                    <div>
                      <dt>O que fazer</dt>
                      <dd>{task.trim()}</dd>
                    </div>
                    <div>
                      <dt>Bairro</dt>
                      <dd>{neighborhood.trim()}</dd>
                    </div>
                  </dl>
                  <p className="review-note">
                    O envio para os profissionais ainda não está disponível nesta versão.
                  </p>
                </div>
              )}
            </div>
          </form>
        </section>

        <section id="servicos" className="services" aria-labelledby="servicos-titulo">
          <h2 id="servicos-titulo">Serviços</h2>
          <ul className="service-list">
            {services.map(({ id, name, examples }) => (
              <li key={id} className="service-row">
                <span className="service-name">{name}</span>
                <span className="service-examples">{examples}</span>
                <button
                  type="button"
                  className="service-action"
                  onClick={() => requestFromList(id)}
                  aria-label={`Pedir orçamento: ${name}`}
                >
                  Pedir orçamento
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section id="como-funciona" className="how" aria-labelledby="como-funciona-titulo">
          <h2 id="como-funciona-titulo">Como funciona</h2>
          <ol className="steps">
            {steps.map(({ title, text }) => (
              <li key={title}>
                <span className="step-title">{title}</span>
                <span className="step-text">{text}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="footer">
        <span className="wordmark">Portal de Serviços</span>
        <span>Orçamentos de serviços para a sua casa.</span>
      </footer>
    </div>
  )
}

export default App

import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, MapPin, Search, X } from 'lucide-react'
import { BlurredPrice, LoginBar } from '../components/LoginBar'
import { Rating } from '../components/Rating'
import { professionalsFor, type Professional } from '../features/profissionais/dados-exemplo'
import { allTasks, professions, type Task } from '../features/servicos/catalogo'
import { routes } from '../hooks/useHashRoute'
import { firstName, formatPrice, initials, normalize } from '../lib/format'
import { contactMessage, openWhatsapp } from '../lib/whatsapp'

type InicioProps = {
  isLoggedIn: boolean
  onLogin: () => void
  onLogout: () => void
}

export function Inicio({ isLoggedIn, onLogin, onLogout }: InicioProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<string[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null)
  const [noWhatsapp, setNoWhatsapp] = useState(false)

  const dialogRef = useRef<HTMLDialogElement>(null)

  const results = useMemo(() => {
    const term = normalize(query.trim())

    return allTasks.filter(({ title, profession }) => {
      const matchesFilter = filters.length === 0 || filters.includes(profession.id)
      const matchesQuery = !term || normalize(`${title} ${profession.name}`).includes(term)
      return matchesFilter && matchesQuery
    })
  }, [query, filters])

  function toggleFilter(id: string) {
    setFilters((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function openTask(task: Task) {
    setSelectedTask(task)
    setSelectedPro(null)
    dialogRef.current?.showModal()
  }

  function choosePro(pro: Professional) {
    setSelectedPro(pro)
    setNoWhatsapp(false)
  }

  const taskPros = selectedTask
    ? professionalsFor(selectedTask.profession.id, selectedTask.title)
    : []
  const selectedPrice = selectedTask && selectedPro ? selectedPro.prices[selectedTask.title] : null
  const proFirstName = selectedPro ? firstName(selectedPro.name) : ''
  // Sem login, só o primeiro nome
  const proName = selectedPro && isLoggedIn ? selectedPro.name : proFirstName

  const activeProfessions = professions.filter(({ id }) => filters.includes(id))
  // Os serviços só aparecem depois de escolher uma profissão ou digitar na busca
  const showResults = filters.length > 0 || query.trim() !== ''

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <span className="wordmark">Portal de Serviços</span>
          <div className="header-links">
            <a className="clear-filters" href={routes.area}>
              Sou prestador
            </a>
            <button
              type="button"
              className="clear-filters"
              onClick={() => {
                if (isLoggedIn) onLogout()
                else onLogin()
                setSelectedPro(null)
              }}
            >
              {isLoggedIn ? 'Sair' : 'Entrar'}
            </button>
          </div>
        </div>

        <div className="search">
          <Search className="search-icon" size={17} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar serviço"
            placeholder="Do que você precisa?"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>

        {activeProfessions.length > 0 && (
          <div className="active-filters" aria-label="Filtros ativos">
            {activeProfessions.map((profession) => (
              <button
                key={profession.id}
                type="button"
                className="filter-tag"
                onClick={() => toggleFilter(profession.id)}
                aria-label={`Remover filtro ${profession.name}`}
              >
                {profession.name}
                <X size={14} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className="clear-filters" onClick={() => setFilters([])}>
              Limpar
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        <section aria-label="Profissões">
          <ul className="profession-grid">
            {professions.map((profession) => {
              const { id, name, icon: Icon } = profession
              const isActive = filters.includes(id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`profession${isActive ? ' is-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => toggleFilter(id)}
                  >
                    <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                    <span>{name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {!showResults && (
          <p className="start-hint">Escolha uma profissão para ver os serviços.</p>
        )}

        {showResults && (
          <section className="results" aria-labelledby="results-title">
            <h2 id="results-title" aria-live="polite">
              {results.length === 1 ? '1 serviço' : `${results.length} serviços`}
            </h2>

            {results.length > 0 ? (
              <ul className="task-list">
                {results.map((task) => {
                  const Icon = task.profession.icon
                  return (
                    <li key={`${task.profession.id}-${task.title}`}>
                      <button
                        type="button"
                        className="task"
                        onClick={() => openTask(task)}
                      >
                        <Icon className="task-icon" size={17} strokeWidth={1.5} aria-hidden="true" />
                        <span className="task-text">
                          <span className="task-title">{task.title}</span>
                          <span className="task-profession">{task.profession.name}</span>
                        </span>
                        <ChevronRight className="task-chevron" size={16} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="empty">
                <p>Nenhum serviço encontrado para essa busca.</p>
                <button
                  type="button"
                  className="clear-filters"
                  onClick={() => {
                    setQuery('')
                    setFilters([])
                  }}
                >
                  Limpar busca e filtros
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="sheet-title"
        onClick={(event) => {
          // Fecha ao tocar fora da folha
          if (event.target === event.currentTarget) dialogRef.current?.close()
        }}
      >
        {selectedTask && !selectedPro && (
          <div className="sheet-body">
            <div className="sheet-head">
              <div>
                <p className="sheet-profession">{selectedTask.profession.name}</p>
                <h2 id="sheet-title">{selectedTask.title}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => dialogRef.current?.close()}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {taskPros.length > 0 && (
              <>
                <p className="sheet-hint">Ordenados pela reputação.</p>

                {!isLoggedIn && (
                  <LoginBar
                    message="Entre para ver os preços e falar com os profissionais."
                    onLogin={onLogin}
                  />
                )}

                <ul className="pro-list">
                  {taskPros.map((pro) => {
                    const price = pro.prices[selectedTask.title]
                    const name = isLoggedIn ? pro.name : firstName(pro.name)
                    return (
                      <li key={pro.id}>
                        <button type="button" className="pro" onClick={() => choosePro(pro)}>
                          <span className="avatar" aria-hidden="true">
                            {initials(name)}
                          </span>
                          <span className="pro-text">
                            <span className="pro-name">{name}</span>
                            <Rating rating={pro.rating} reviews={pro.reviews} />
                            <span className="pro-place">{pro.neighborhood}</span>
                          </span>
                          <span className="pro-price">
                            {price == null ? (
                              <small>a combinar</small>
                            ) : (
                              <>
                                <small>média</small>
                                {isLoggedIn ? formatPrice(price) : <BlurredPrice />}
                              </>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}

            {taskPros.length === 0 && (
              <p className="sheet-hint">Ainda não há profissionais para este serviço.</p>
            )}
          </div>
        )}

        {selectedTask && selectedPro && (
          <div className="sheet-body">
            <div className="sheet-head">
              <button
                type="button"
                className="icon-button"
                aria-label="Voltar para a lista de profissionais"
                onClick={() => setSelectedPro(null)}
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => dialogRef.current?.close()}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="profile">
              <span className="avatar avatar-large" aria-hidden="true">
                {initials(proName)}
              </span>
              <div>
                <h2 id="sheet-title">{proName}</h2>
                <p className="sheet-profession">{selectedTask.profession.name}</p>
                <Rating rating={selectedPro.rating} reviews={selectedPro.reviews} />
                <span className="pro-place">
                  <MapPin size={13} aria-hidden="true" /> {selectedPro.neighborhood}
                </span>
                <a className="clear-filters profile-link" href={routes.perfil(selectedPro.id)}>
                  Ver perfil completo
                </a>
              </div>
            </div>

            <div className="price-box">
              <span className="price-task">{selectedTask.title}</span>
              {selectedPrice != null ? (
                <>
                  <span className="price-value">
                    {isLoggedIn ? formatPrice(selectedPrice) : <BlurredPrice />}
                  </span>
                  <span className="price-note">
                    Preço médio informado por {proFirstName}. O valor final é combinado na
                    conversa, depois que {proFirstName} entender o serviço.
                  </span>
                </>
              ) : (
                <>
                  <span className="price-value">A combinar</span>
                  <span className="price-note">
                    {proFirstName} passa o valor depois de conversar com você sobre o serviço.
                  </span>
                </>
              )}
            </div>

            <div aria-live="polite">
              {noWhatsapp && (
                <p className="form-error">
                  {proFirstName} ainda não cadastrou o WhatsApp. Tente outro profissional.
                </p>
              )}
            </div>

            {!isLoggedIn && (
              <LoginBar
                id="contact-locked"
                message={`Entre para ver o preço e falar com ${proFirstName}.`}
                onLogin={onLogin}
              />
            )}

            <button
              type="button"
              className="primary"
              disabled={!isLoggedIn}
              aria-describedby={isLoggedIn ? undefined : 'contact-locked'}
              onClick={() => {
                // TODO: registrar o contato no Supabase para aparecer em "Contatos" do prestador.
                if (selectedPro.whatsapp) {
                  openWhatsapp(selectedPro.whatsapp, contactMessage(proFirstName, selectedTask.title))
                } else {
                  setNoWhatsapp(true)
                }
              }}
            >
              Falar com {proFirstName} no WhatsApp
            </button>
          </div>
        )}
      </dialog>
    </div>
  )
}

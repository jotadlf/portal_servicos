import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, MapPin, Search, X } from 'lucide-react'
import logo from '../assets/zumzum-icone.svg'
import { Avatar } from '../components/Avatar'
import { BottomMenu } from '../components/BottomMenu'
import { BlurredPrice, LoginBar } from '../components/LoginBar'
import { Rating } from '../components/Rating'
import { LoadError, Loading } from '../components/Status'
import { WhatsappIcon } from '../components/WhatsappIcon'
import {
  fetchProfessionalsFor,
  serviceFor,
  type OfferedService,
  type Professional,
} from '../features/profissionais/prestadores'
import { fetchCatalog, getAllTasks, type Task } from '../features/servicos/catalogo'
import { useApi } from '../hooks/useApi'
import { routes } from '../hooks/useHashRoute'
import { firstName, formatPrice, greeting, normalize } from '../lib/format'
import { contactMessage, formatPhone, openWhatsapp } from '../lib/whatsapp'

type InicioProps = {
  isLoggedIn: boolean
  isAdmin: boolean
  userName: string
  onLogin: () => void
  onLogout: () => void
}

export function Inicio({ isLoggedIn, isAdmin, userName, onLogin, onLogout }: InicioProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<string[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null)
  const [noWhatsapp, setNoWhatsapp] = useState(false)
  // Busca por nome e ordem da lista de profissionais do serviço aberto
  const [proQuery, setProQuery] = useState('')
  const [proSort, setProSort] = useState<ProSort>('reputacao')

  const dialogRef = useRef<HTMLDialogElement>(null)
  const catalog = useApi(fetchCatalog)
  const professions = useMemo(() => catalog.data ?? [], [catalog.data])

  // Profissionais do serviço aberto; carrega de novo ao trocar de serviço
  const taskKey = selectedTask ? `${selectedTask.profession.id}|${selectedTask.title}` : ''
  const pros = useApi(
    () =>
      selectedTask
        ? fetchProfessionalsFor(selectedTask.profession.id, selectedTask.title)
        : Promise.resolve([]),
    taskKey,
  )

  const results = useMemo(() => {
    const term = normalize(query.trim())

    return getAllTasks(professions).filter(({ title, profession }) => {
      const matchesFilter = filters.length === 0 || filters.includes(profession.id)
      const matchesQuery = !term || normalize(`${title} ${profession.name}`).includes(term)
      return matchesFilter && matchesQuery
    })
  }, [query, filters, professions])

  function toggleFilter(id: string) {
    setFilters((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function openTask(task: Task) {
    setSelectedTask(task)
    setSelectedPro(null)
    setProQuery('')
    dialogRef.current?.showModal()
  }

  function choosePro(pro: Professional) {
    setSelectedPro(pro)
    setNoWhatsapp(false)
  }

  const taskPros = pros.data ?? []
  // Sem login, só o primeiro nome: a busca e a ordem usam o nome que está na tela
  const shownName = (pro: Professional) => (isLoggedIn ? pro.name : firstName(pro.name))
  // Sem login não há preço; a ordem por valor revelaria quem cobra menos
  const sort = proSort === 'valor' && !isLoggedIn ? 'reputacao' : proSort
  const listedPros = sortPros(
    taskPros.filter((pro) => normalize(shownName(pro)).includes(normalize(proQuery.trim()))),
    sort,
    shownName,
    (pro) => (selectedTask ? serviceFor(pro, selectedTask.title)?.price : null) ?? null,
  )
  const selectedService = selectedTask && selectedPro ? serviceFor(selectedPro, selectedTask.title) : undefined
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
          <div className="brand">
            <img className="brand-icon" src={logo} alt="zumzum" width={36} height={36} />
            <span className="wordmark">
              {isLoggedIn ? `${greeting()}, ${firstName(userName)}` : greeting()}
            </span>
          </div>
          <div className="header-links">
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
      </header>

      <main className="app-main">
        <section className="banner" aria-label="Destaques" />

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

        <section aria-label="Profissões">
          {catalog.error && <LoadError message={catalog.error} onRetry={catalog.reload} />}
          {catalog.loading && !catalog.data && <Loading />}
          <ul className="profession-grid">
            {professions.map((profession) => {
              const { id, name, image, icon: Icon } = profession
              const isActive = filters.includes(id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`profession${isActive ? ' is-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => toggleFilter(id)}
                  >
                    <span className="profession-tile">
                      {image ? (
                        <img src={image} alt="" width={56} height={56} />
                      ) : (
                        <Icon size={30} strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </span>
                    <span className="profession-name">{name}</span>
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

            {pros.loading && <Loading label="Buscando profissionais…" />}
            {pros.error && <LoadError message={pros.error} onRetry={pros.reload} />}

            {!pros.loading && taskPros.length > 0 && (
              <>
                <div className="pro-tools">
                  <div className="search">
                    <Search className="search-icon" size={17} aria-hidden="true" />
                    <input
                      type="search"
                      aria-label="Procurar profissional por nome"
                      placeholder="Procurar nome"
                      value={proQuery}
                      onChange={(event) => setProQuery(event.currentTarget.value)}
                    />
                  </div>
                  <select
                    className="pro-sort"
                    aria-label="Ordenar por"
                    value={sort}
                    onChange={(event) => setProSort(event.currentTarget.value as ProSort)}
                  >
                    <option value="reputacao">Reputação</option>
                    <option value="nome">Nome</option>
                    <option value="valor" disabled={!isLoggedIn}>
                      {isLoggedIn ? 'Menor valor' : 'Menor valor (entre para ver)'}
                    </option>
                  </select>
                </div>

                {listedPros.length === 0 && (
                  <p className="sheet-hint">Nenhum profissional com esse nome.</p>
                )}

                <ul className="pro-list" hidden={listedPros.length === 0}>
                  {listedPros.map((pro) => {
                    const service = serviceFor(pro, selectedTask.title)
                    const name = isLoggedIn ? pro.name : firstName(pro.name)
                    return (
                      <li key={pro.id} className="pro-row">
                        <button type="button" className="pro" onClick={() => choosePro(pro)}>
                          <Avatar name={name} photo={pro.photo} />
                          <span className="pro-text">
                            <span className="pro-name">{name}</span>
                            <Rating rating={pro.rating} reviews={pro.reviews} />
                            <span className="pro-place">{pro.neighborhood}</span>
                          </span>
                          <span className="pro-price">
                            {hasPrice(service) ? (
                              <>
                                <small>média</small>
                                <PriceValue service={service} />
                              </>
                            ) : (
                              <small>a combinar</small>
                            )}
                          </span>
                        </button>
                        {/* Contato direto da lista. O número só vem do servidor para quem entrou;
                            sem login, um número falso desfocado, como o preço, e o toque leva ao login. */}
                        {isLoggedIn ? (
                          pro.whatsapp && (
                            <button
                              type="button"
                              className="pro-whatsapp"
                              aria-label={`Falar com ${firstName(pro.name)} no WhatsApp`}
                              onClick={() =>
                                openWhatsapp(
                                  pro.whatsapp!,
                                  contactMessage(firstName(pro.name), selectedTask.title),
                                )
                              }
                            >
                              <WhatsappIcon />
                              {formatPhone(pro.whatsapp)}
                            </button>
                          )
                        ) : (
                          <button type="button" className="pro-whatsapp" onClick={onLogin}>
                            <WhatsappIcon />
                            <span className="price-blur" aria-hidden="true">
                              (62) 00000-0000
                            </span>
                            <span className="visually-hidden">WhatsApp visível após entrar</span>
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {/* Preso no rodapé da folha: continua à mão com a lista rolando */}
                {!isLoggedIn && (
                  <div className="sheet-login">
                    <LoginBar
                      message="Entre para ver os preços e falar com os profissionais."
                      onLogin={onLogin}
                    />
                  </div>
                )}
              </>
            )}

            {!pros.loading && !pros.error && taskPros.length === 0 && (
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
              <Avatar name={proName} photo={selectedPro.photo} large />
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
              {hasPrice(selectedService) ? (
                <>
                  <span className="price-value">
                    <PriceValue service={selectedService} />
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

      <BottomMenu
        current="inicio"
        showAdmin={isAdmin}
        onInicio={() => {
          setQuery('')
          setFilters([])
        }}
      />
    </div>
  )
}

type ProSort = 'reputacao' | 'nome' | 'valor'

// A lista chega do servidor já pela reputação; os empates das outras ordens mantêm essa ordem
function sortPros(
  pros: Professional[],
  sort: ProSort,
  nameOf: (pro: Professional) => string,
  priceOf: (pro: Professional) => number | null,
) {
  if (sort === 'nome') return [...pros].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'pt-BR'))
  if (sort === 'valor') {
    // "A combinar" vai para o fim
    const price = (pro: Professional) => priceOf(pro) ?? Number.POSITIVE_INFINITY
    return [...pros].sort((a, b) => price(a) - price(b))
  }
  return pros
}

// Há preço informado (mesmo que escondido para quem não entrou)
function hasPrice(service: OfferedService | undefined): service is OfferedService {
  return service !== undefined && (service.hidden === true || service.price !== null)
}

// Sem login o servidor não manda o valor: mostra o preço desfocado de mentira
function PriceValue({ service }: { service: OfferedService }) {
  return service.hidden || service.price === null ? <BlurredPrice /> : <>{formatPrice(service.price)}</>
}

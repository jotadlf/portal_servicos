import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import { BottomMenu } from '../components/BottomMenu'
import { LoginBar } from '../components/LoginBar'
import { PlanOffer } from '../components/PlanOffer'
import { Rating } from '../components/Rating'
import { LoadError, Loading } from '../components/Status'
import { findPlan, formatMoney, type PlanSettings } from '../features/conta/plano'
import { fetchPlanSettings } from '../features/conta/plano-api'
import { becomeProvider, type Account } from '../features/conta/usuario'
import {
  fetchContacts,
  fetchOwnProfessional,
  fetchReviews,
  markContactAnswered,
  saveAbout,
  saveServices,
  type ContactRequest,
  type OfferedService,
  type Professional,
  type Review,
} from '../features/profissionais/prestadores'
import { fetchCatalog, findProfession, type Profession } from '../features/servicos/catalogo'
import { useApi } from '../hooks/useApi'
import { routes } from '../hooks/useHashRoute'
import { errorMessage } from '../lib/api'
import { formatDate, formatPrice, formatRating, normalize } from '../lib/format'

const tabs = [
  { id: 'servicos', label: 'Meus serviços' },
  { id: 'contatos', label: 'Contatos' },
  { id: 'avaliacoes', label: 'Avaliações' },
] as const

type TabId = (typeof tabs)[number]['id']

type ServicosProps = {
  account?: Account
  onLogin: () => void
  onAccountChange: (account: Account) => void
}

export function Servicos({ account, onLogin, onAccountChange }: ServicosProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function startOffering() {
    setBusy(true)
    setError('')
    try {
      onAccountChange(await becomeProvider())
    } catch (failure) {
      setError(errorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <main className="page">
        {account?.professionalId ? (
          <PainelLoader />
        ) : (
          <div className="page-section">
            <h1 className="page-title">Ofereça seus serviços</h1>
            <p className="section-note">
              Cadastre os serviços que você faz, informe o preço médio e receba contatos de
              clientes da sua região.
            </p>
            <PlanOffer />
            {account ? (
              <>
                <div aria-live="polite">{error && <p className="form-error">{error}</p>}</div>
                <button type="button" className="primary" disabled={busy} onClick={startOffering}>
                  {busy ? 'Preparando…' : 'Quero oferecer serviços'}
                </button>
              </>
            ) : (
              <LoginBar message="Entre para cadastrar seus serviços." onLogin={onLogin} />
            )}
          </div>
        )}
      </main>

      <BottomMenu current="servicos" showAdmin={account?.isAdmin} />
    </div>
  )
}

type PainelData = {
  pro: Professional
  professions: Profession[]
  settings: PlanSettings
  contacts: ContactRequest[]
  reviews: Review[]
}

// Carrega tudo de que o painel precisa de uma vez
function PainelLoader() {
  const data = useApi(async (): Promise<PainelData> => {
    const [pro, professions, settings, contacts] = await Promise.all([
      fetchOwnProfessional(),
      fetchCatalog(),
      fetchPlanSettings(),
      fetchContacts(),
    ])
    // Avaliações públicas só existem depois de publicar
    const reviews = pro.status === 'publicado' ? await fetchReviews(pro.id) : []
    return { pro, professions, settings, contacts, reviews }
  })

  if (data.loading && !data.data) return <Loading />
  if (!data.data) return <LoadError message={data.error ?? ''} onRetry={data.reload} />
  return <Painel {...data.data} />
}

function Painel(props: PainelData) {
  const { professions, settings, reviews } = props
  const [tab, setTab] = useState<TabId>('servicos')
  // O cartão de publicação acompanha a lista de serviços gravada
  const [pro, setPro] = useState(props.pro)
  const [contacts, setContacts] = useState(props.contacts)

  const newContacts = contacts.filter((contact) => !contact.answered).length

  return (
    <>
      <h1 className="page-title">Serviços</h1>

      {pro.status === 'rascunho' ? (
        <PublishCard pro={pro} />
      ) : (
        <p className="notice">
          Perfil publicado. <PublishedPlan pro={pro} settings={settings} />
        </p>
      )}

      {pro.status === 'publicado' && !pro.whatsapp && (
        <p className="notice">
          Cadastre seu WhatsApp no <a href={routes.conta}>Perfil</a> para receber contatos.
        </p>
      )}

      <nav className="tabs" aria-label="Seções de serviços">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? ' is-active' : ''}`}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'contatos' && newContacts > 0 && (
              <span className="tab-count" aria-label={`${newContacts} novos`}>
                {newContacts}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'servicos' && (
        <>
          <ServicosForm pro={pro} professions={professions} onSaved={setPro} />
          <SobreForm pro={pro} />
        </>
      )}
      {tab === 'contatos' && <Contatos contacts={contacts} onChange={setContacts} />}
      {tab === 'avaliacoes' && <Avaliacoes pro={pro} reviews={reviews} />}
    </>
  )
}

// O que falta para publicar: sem foto, WhatsApp ou serviços o perfil não passaria confiança
// nem teria utilidade. O servidor confere o mesmo ao publicar.
function PublishCard({ pro }: { pro: Professional }) {
  const steps = [
    { done: Boolean(pro.photo), label: 'Foto no Perfil', href: routes.conta },
    { done: Boolean(pro.whatsapp), label: 'WhatsApp cadastrado no Perfil', href: routes.conta },
    { done: pro.services.length > 0, label: 'Pelo menos um serviço cadastrado' },
  ]
  const ready = steps.every(({ done }) => done)

  return (
    <section className="publish-card" aria-labelledby="publicar-titulo">
      <h2 id="publicar-titulo">Seu perfil ainda não aparece nas buscas</h2>
      <p>Publique para receber contatos de clientes.</p>
      <PlanOffer compact />
      <ul className="publish-steps">
        {steps.map(({ done, label, href }) => (
          <li key={label} className={done ? 'is-done' : undefined}>
            {done ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
            {href && !done ? <a href={href}>{label}</a> : label}
            <span className="visually-hidden">{done ? ' (feito)' : ' (pendente)'}</span>
          </li>
        ))}
      </ul>
      {ready ? (
        <a className="primary publish-button" href={routes.publicar}>
          Publicar
        </a>
      ) : (
        <button type="button" className="primary publish-button" disabled>
          Publicar
        </button>
      )}
    </section>
  )
}

function PublishedPlan({ pro, settings }: { pro: Professional; settings: PlanSettings }) {
  const plan = findPlan(settings, pro.plan ?? 'mensal')
  const price = `${formatMoney(plan.price)} ${plan.period}`
  return pro.trialEndsAt
    ? `Plano ${plan.label.toLowerCase()}: grátis até ${formatDate(pro.trialEndsAt)}, depois ${price}.`
    : `Plano ${plan.label.toLowerCase()}: ${price}.`
}

function SobreForm({ pro }: { pro: Professional }) {
  const [about, setAbout] = useState(pro.about ?? '')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      setAbout((await saveAbout(about)).about)
      setSaved(true)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="page-section form"
      onSubmit={handleSubmit}
      onChange={() => {
        setSaved(false)
        setError('')
      }}
    >
      <label className="field">
        <span>Sobre seu trabalho</span>
        <textarea
          rows={4}
          maxLength={300}
          placeholder="Conte há quanto tempo trabalha, como atende e o que leva para o serviço."
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
      </label>

      <div aria-live="polite">
        {error && <p className="form-error">{error}</p>}
        {saved && <p className="form-ready">Texto salvo.</p>}
      </div>
      <div className="form-actions">
        <a className="clear-filters" href={routes.perfil(pro.id)}>
          Ver como os clientes veem
        </a>
        <button type="submit" className="login-button" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

type Service = OfferedService & { id: string }

const withIds = (services: OfferedService[]): Service[] =>
  services.map((service, index) => ({ ...service, id: `s${index}-${service.name}` }))

type ServicosFormProps = {
  pro: Professional
  professions: Profession[]
  onSaved: (pro: Professional) => void
}

function ServicosForm({ pro, professions, onSaved }: ServicosFormProps) {
  const [services, setServices] = useState<Service[]>(() => withIds(pro.services))
  // id do serviço em edição, 'novo' ao adicionar, ou null
  const [editing, setEditing] = useState<string | null>(null)
  const [removed, setRemoved] = useState<{ service: Service; index: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Profissão já marcada num serviço novo: a do último serviço cadastrado
  const lastProfessionId = services.at(-1)?.professionId ?? professions[0]?.id ?? ''

  // Agrupa por profissão, na ordem do catálogo
  const groups = professions
    .map((profession) => ({
      profession,
      items: services.filter((service) => service.professionId === profession.id),
    }))
    .filter(({ items }) => items.length > 0)

  // Grava a lista inteira; só troca a tela se o servidor aceitar
  async function commit(next: Service[]) {
    setBusy(true)
    setError('')
    try {
      const saved = await saveServices(next)
      setServices(next)
      onSaved(saved)
      return true
    } catch (failure) {
      setError(errorMessage(failure))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save(service: Service) {
    const next = service.id
      ? services.map((item) => (item.id === service.id ? service : item))
      : [...services, { ...service, id: `s${Date.now()}` }]
    if (await commit(next)) setEditing(null)
  }

  async function remove(service: Service) {
    const index = services.indexOf(service)
    if (await commit(services.filter(({ id }) => id !== service.id))) {
      setRemoved({ service, index })
    }
  }

  async function undoRemove() {
    if (!removed) return
    const next = [...services]
    next.splice(removed.index, 0, removed.service)
    if (await commit(next)) setRemoved(null)
  }

  // Mesmo nome só conta como repetido dentro da mesma profissão
  function isDuplicate(name: string, professionId: string, id: string) {
    return services.some(
      (item) =>
        item.id !== id &&
        item.professionId === professionId &&
        normalize(item.name) === normalize(name),
    )
  }

  return (
    <section className="page-section" aria-label="Meus serviços" aria-busy={busy}>
      {services.length === 0 && editing !== 'novo' && (
        <p className="section-note">
          Você ainda não oferece nenhum serviço. Adicione o primeiro para aparecer nas buscas.
        </p>
      )}

      {groups.map(({ profession, items }) => (
        <div key={profession.id} className="service-group">
          <h2 className="service-group-title">
            {profession.image ? (
              <img src={profession.image} alt="" width={20} height={20} />
            ) : (
              <profession.icon size={18} aria-hidden="true" />
            )}
            {profession.name}
          </h2>
          <ul className="line-list">
            {items.map((service) =>
              editing === service.id ? (
                <li key={service.id}>
                  <ServiceEditor
                    service={service}
                    professions={professions}
                    busy={busy}
                    isDuplicate={isDuplicate}
                    onSave={save}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li key={service.id} className="line">
                  <span className="service-name">
                    {service.name}
                    <small>
                      {service.price == null ? 'a combinar' : `média ${formatPrice(service.price)}`}
                    </small>
                  </span>
                  <span className="line-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Editar ${service.name}`}
                      disabled={busy}
                      onClick={() => setEditing(service.id)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Apagar ${service.name}`}
                      disabled={busy}
                      onClick={() => remove(service)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}

      <div aria-live="polite">
        {error && <p className="form-error">{error}</p>}
        {removed && (
          <p className="undo">
            {removed.service.name} apagado.{' '}
            <button type="button" className="clear-filters" disabled={busy} onClick={undoRemove}>
              Desfazer
            </button>
          </p>
        )}
      </div>

      {editing === 'novo' ? (
        <ServiceEditor
          service={{ id: '', professionId: lastProfessionId, name: '', price: null }}
          professions={professions}
          busy={busy}
          isDuplicate={isDuplicate}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          className="add-button"
          onClick={() => {
            setEditing('novo')
            setRemoved(null)
          }}
        >
          <Plus size={18} aria-hidden="true" />
          Adicionar serviço
        </button>
      )}
    </section>
  )
}

type ServiceEditorProps = {
  service: Service
  professions: Profession[]
  busy: boolean
  isDuplicate: (name: string, professionId: string, id: string) => boolean
  onSave: (service: Service) => void
  onCancel: () => void
}

function ServiceEditor({ service, professions, busy, isDuplicate, onSave, onCancel }: ServiceEditorProps) {
  const [professionId, setProfessionId] = useState(service.professionId)
  const [name, setName] = useState(service.name)
  const [price, setPrice] = useState(service.price == null ? '' : String(service.price))
  const [error, setError] = useState('')

  const suggestions = findProfession(professions, professionId)?.tasks ?? []

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setError('Informe o nome do serviço.')
      return
    }
    if (isDuplicate(trimmed, professionId, service.id)) {
      setError('Você já tem um serviço com esse nome nesta profissão.')
      return
    }

    onSave({ id: service.id, professionId, name: trimmed, price: price ? Number(price) : null })
  }

  return (
    <form className="service-editor" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span>Profissão</span>
        <select
          value={professionId}
          onChange={(e) => {
            setProfessionId(e.target.value)
            setError('')
          }}
        >
          {professions.map(({ id, name: label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Serviço</span>
        <input
          autoFocus
          list="sugestoes-servico"
          maxLength={60}
          placeholder="Ex.: Instalar ventilador de teto"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
        />
        <datalist id="sugestoes-servico">
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>Preço médio (opcional)</span>
        <span className="price-input">
          <span aria-hidden="true">R$</span>
          <input
            inputMode="numeric"
            placeholder="a combinar"
            maxLength={6}
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
          />
        </span>
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="editor-actions">
        <button type="button" className="clear-filters" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="login-button" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

function Contatos({
  contacts,
  onChange,
}: {
  contacts: ContactRequest[]
  onChange: (contacts: ContactRequest[]) => void
}) {
  const [error, setError] = useState('')

  async function markAnswered(id: string) {
    setError('')
    try {
      await markContactAnswered(id)
      onChange(contacts.map((contact) => (contact.id === id ? { ...contact, answered: true } : contact)))
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  if (contacts.length === 0) {
    return (
      <div className="page-section empty">
        <p>Nenhum cliente pediu contato ainda.</p>
      </div>
    )
  }

  return (
    <section className="page-section">
      <div aria-live="polite">{error && <p className="form-error">{error}</p>}</div>
      <ul className="review-list">
        {contacts.map((contact) => (
          <li key={contact.id} className="review">
            <div className="review-head">
              <strong>{contact.client}</strong>
              {!contact.answered && <span className="badge">Novo</span>}
              <span className="review-date">{formatDate(contact.date)}</span>
            </div>
            <p className="contact-task">
              {contact.task}, {contact.neighborhood}
            </p>
            {contact.message && <p>{contact.message}</p>}
            {!contact.answered && (
              <button
                type="button"
                className="clear-filters"
                onClick={() => markAnswered(contact.id)}
              >
                Marcar como respondido
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Avaliacoes({ pro, reviews }: { pro: Professional; reviews: Review[] }) {
  return (
    <section className="page-section">
      <div className="score">
        <span className="score-value">{formatRating(pro.rating)}</span>
        <Rating rating={pro.rating} reviews={pro.reviews} />
      </div>

      {reviews.length > 0 ? (
        <ul className="review-list">
          {reviews.map((review) => (
            <li key={review.id} className="review">
              <div className="review-head">
                <strong>{review.author}</strong>
                <span className="review-stars">
                  <Star className="star" size={12} aria-hidden="true" />
                  {review.rating}
                  <span className="visually-hidden"> de 5</span>
                </span>
                <span className="review-date">{formatDate(review.date)}</span>
              </div>
              <p>{review.comment}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-note">Você ainda não recebeu comentários escritos.</p>
      )}
    </section>
  )
}

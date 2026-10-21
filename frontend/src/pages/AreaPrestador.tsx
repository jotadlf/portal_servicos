import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { LoginBar } from '../components/LoginBar'
import { PageBar } from '../components/PageBar'
import { Rating } from '../components/Rating'
import {
  contactsFor,
  getProfessional,
  reviewsFor,
  updateProfessional,
  type Professional,
} from '../features/profissionais/dados-exemplo'
import { findProfession, professions } from '../features/servicos/catalogo'
import { routes } from '../hooks/useHashRoute'
import { formatDate, formatPrice, formatRating, normalize } from '../lib/format'
import { formatPhone, isValidPhone } from '../lib/whatsapp'

// TODO: usar o prestador do usuário logado (Supabase Auth). No protótipo é sempre o Carlos.
const LOGGED_PROFESSIONAL_ID = 'p1'

const tabs = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'contatos', label: 'Contatos' },
  { id: 'avaliacoes', label: 'Avaliações' },
] as const

type TabId = (typeof tabs)[number]['id']

type AreaPrestadorProps = {
  isLoggedIn: boolean
  onLogin: () => void
}

export function AreaPrestador({ isLoggedIn, onLogin }: AreaPrestadorProps) {
  const pro = getProfessional(LOGGED_PROFESSIONAL_ID)

  return (
    <div className="app">
      <PageBar title="Área do prestador" />
      <main className="page">
        {isLoggedIn && pro ? (
          <Painel pro={pro} />
        ) : (
          <div className="page-section">
            <h1 className="page-title">Ofereça seus serviços</h1>
            <p className="section-note">
              Monte seu perfil, informe o preço médio dos seus serviços e receba contatos de
              clientes da sua região.
            </p>
            <LoginBar message="Entre para acessar sua área de prestador." onLogin={onLogin} />
          </div>
        )}
      </main>
    </div>
  )
}

function Painel({ pro }: { pro: Professional }) {
  const [tab, setTab] = useState<TabId>('perfil')

  const newContacts = contactsFor(pro.id).filter((contact) => !contact.answered).length

  return (
    <>
      <nav className="tabs" aria-label="Seções da área do prestador">
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

      {tab === 'perfil' && <PerfilForm pro={pro} />}
      {tab === 'servicos' && <ServicosForm pro={pro} />}
      {tab === 'contatos' && <Contatos pro={pro} />}
      {tab === 'avaliacoes' && <Avaliacoes pro={pro} />}
    </>
  )
}

function SavedNote({ show }: { show: boolean }) {
  return (
    <div aria-live="polite">
      {show && (
        <p className="form-ready">
          Alterações salvas nesta sessão. A gravação no servidor ainda não está disponível.
        </p>
      )}
    </div>
  )
}

function PerfilForm({ pro }: { pro: Professional }) {
  const [name, setName] = useState(pro.name)
  const [professionId, setProfessionId] = useState(pro.professionId)
  const [neighborhood, setNeighborhood] = useState(pro.neighborhood)
  const [about, setAbout] = useState(pro.about ?? '')
  const [whatsapp, setWhatsapp] = useState(formatPhone(pro.whatsapp ?? ''))
  const [whatsappError, setWhatsappError] = useState('')
  const [saved, setSaved] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = whatsapp.replace(/\D/g, '')

    if (!isValidPhone(digits)) {
      setWhatsappError('Informe o WhatsApp com DDD, por exemplo (62) 99999-9999.')
      return
    }

    updateProfessional(pro.id, {
      name: name.trim(),
      professionId,
      neighborhood: neighborhood.trim(),
      about: about.trim(),
      whatsapp: digits,
    })
    setSaved(true)
  }

  return (
    <form className="page-section form" onSubmit={handleSubmit} onChange={() => setSaved(false)}>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="field">
        <span>Profissão</span>
        <select value={professionId} onChange={(e) => setProfessionId(e.target.value)}>
          {professions.map(({ id, name: label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Bairro onde atende</span>
        <input
          required
          maxLength={50}
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
        />
      </label>

      <label className="field">
        <span>WhatsApp</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(62) 99999-9999"
          aria-invalid={whatsappError ? true : undefined}
          aria-describedby="whatsapp-ajuda"
          value={whatsapp}
          onChange={(e) => {
            setWhatsapp(formatPhone(e.target.value))
            setWhatsappError('')
          }}
        />
        <small id="whatsapp-ajuda" className={whatsappError ? 'form-error' : 'field-help'}>
          {whatsappError ||
            'Os clientes que tocarem em contato vão abrir uma conversa com este número.'}
        </small>
      </label>

      <label className="field">
        <span>Sobre você</span>
        <textarea
          rows={4}
          maxLength={300}
          placeholder="Conte há quanto tempo trabalha, como atende e o que leva para o serviço."
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
      </label>

      <SavedNote show={saved} />
      <div className="form-actions">
        <a className="clear-filters" href={routes.perfil(pro.id)}>
          Ver como os clientes veem
        </a>
        <button type="submit" className="primary">
          Salvar perfil
        </button>
      </div>
    </form>
  )
}

type Service = { id: string; name: string; price: number | null }

function ServicosForm({ pro }: { pro: Professional }) {
  const [services, setServices] = useState<Service[]>(() =>
    Object.entries(pro.prices).map(([name, price], index) => ({ id: `s${index}`, name, price })),
  )
  // id do serviço em edição, 'novo' ao adicionar, ou null
  const [editing, setEditing] = useState<string | null>(null)
  const [removed, setRemoved] = useState<{ service: Service; index: number } | null>(null)

  const suggestions = findProfession(pro.professionId)?.tasks ?? []

  // TODO: gravar as alterações de serviços no Supabase.
  function save(service: Service) {
    setServices((current) =>
      service.id
        ? current.map((item) => (item.id === service.id ? service : item))
        : [...current, { ...service, id: `s${Date.now()}` }],
    )
    setEditing(null)
  }

  function remove(service: Service) {
    setRemoved({ service, index: services.indexOf(service) })
    setServices((current) => current.filter(({ id }) => id !== service.id))
  }

  function undoRemove() {
    if (!removed) return
    setServices((current) => {
      const next = [...current]
      next.splice(removed.index, 0, removed.service)
      return next
    })
    setRemoved(null)
  }

  function isDuplicate(name: string, id: string) {
    return services.some((item) => item.id !== id && normalize(item.name) === normalize(name))
  }

  return (
    <section className="page-section">
      {services.length > 0 && (
        <ul className="line-list">
          {services.map((service) =>
            editing === service.id ? (
              <li key={service.id}>
                <ServiceEditor
                  service={service}
                  suggestions={suggestions}
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
                    onClick={() => setEditing(service.id)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Apagar ${service.name}`}
                    onClick={() => remove(service)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <div aria-live="polite">
        {removed && (
          <p className="undo">
            {removed.service.name} apagado.{' '}
            <button type="button" className="clear-filters" onClick={undoRemove}>
              Desfazer
            </button>
          </p>
        )}
      </div>

      {editing === 'novo' ? (
        <ServiceEditor
          service={{ id: '', name: '', price: null }}
          suggestions={suggestions}
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
  suggestions: string[]
  isDuplicate: (name: string, id: string) => boolean
  onSave: (service: Service) => void
  onCancel: () => void
}

function ServiceEditor({ service, suggestions, isDuplicate, onSave, onCancel }: ServiceEditorProps) {
  const [name, setName] = useState(service.name)
  const [price, setPrice] = useState(service.price == null ? '' : String(service.price))
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setError('Informe o nome do serviço.')
      return
    }
    if (isDuplicate(trimmed, service.id)) {
      setError('Você já tem um serviço com esse nome.')
      return
    }

    onSave({ id: service.id, name: trimmed, price: price ? Number(price) : null })
  }

  return (
    <form className="service-editor" onSubmit={handleSubmit} noValidate>
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
        <button type="submit" className="login-button">
          Salvar
        </button>
      </div>
    </form>
  )
}

function Contatos({ pro }: { pro: Professional }) {
  const [contacts, setContacts] = useState(() => contactsFor(pro.id))

  function markAnswered(id: string) {
    // TODO: gravar o status no Supabase.
    setContacts((current) =>
      current.map((contact) => (contact.id === id ? { ...contact, answered: true } : contact)),
    )
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

function Avaliacoes({ pro }: { pro: Professional }) {
  const comments = reviewsFor(pro.id)

  return (
    <section className="page-section">
      <div className="score">
        <span className="score-value">{formatRating(pro.rating)}</span>
        <Rating rating={pro.rating} reviews={pro.reviews} />
      </div>

      {comments.length > 0 ? (
        <ul className="review-list">
          {comments.map((review) => (
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

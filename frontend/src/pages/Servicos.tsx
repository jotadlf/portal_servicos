import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import { BottomMenu } from '../components/BottomMenu'
import { LoginBar } from '../components/LoginBar'
import { PlanOffer } from '../components/PlanOffer'
import { Rating } from '../components/Rating'
import { findPlan, formatMoney } from '../features/conta/plano'
import { becomeProvider, getAccountProfessional, type Account } from '../features/conta/usuario'
import {
  contactsFor,
  reviewsFor,
  updateProfessional,
  type OfferedService,
  type Professional,
} from '../features/profissionais/dados-exemplo'
import { findProfession, professions } from '../features/servicos/catalogo'
import { routes } from '../hooks/useHashRoute'
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
}

export function Servicos({ account, onLogin }: ServicosProps) {
  // Muda quando a pessoa decide oferecer serviços, para a página trocar de conteúdo
  const [professionalId, setProfessionalId] = useState(account?.professionalId)
  const pro = account && professionalId ? getAccountProfessional(account) : undefined

  return (
    <div className="app">
      <main className="page">
        {pro ? (
          <Painel pro={pro} />
        ) : (
          <div className="page-section">
            <h1 className="page-title">Ofereça seus serviços</h1>
            <p className="section-note">
              Cadastre os serviços que você faz, informe o preço médio e receba contatos de
              clientes da sua região.
            </p>
            <PlanOffer />
            {account ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  becomeProvider(account.id)
                  setProfessionalId(account.professionalId)
                }}
              >
                Quero oferecer serviços
              </button>
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

function Painel({ pro }: { pro: Professional }) {
  const [tab, setTab] = useState<TabId>('servicos')
  // Faz o cartão de publicação reagir quando a lista de serviços muda
  const [, setVersion] = useState(0)

  const newContacts = contactsFor(pro.id).filter((contact) => !contact.answered).length

  return (
    <>
      <h1 className="page-title">Serviços</h1>

      {pro.status === 'rascunho' ? (
        <PublishCard pro={pro} />
      ) : (
        <p className="notice">
          Perfil publicado.{' '}
          <PublishedPlan pro={pro} />
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
          <ServicosForm pro={pro} onChange={() => setVersion((v) => v + 1)} />
          <SobreForm pro={pro} />
        </>
      )}
      {tab === 'contatos' && <Contatos pro={pro} />}
      {tab === 'avaliacoes' && <Avaliacoes pro={pro} />}
    </>
  )
}

// O que falta para publicar: sem WhatsApp ou sem serviços o perfil não teria utilidade
function PublishCard({ pro }: { pro: Professional }) {
  const steps = [
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

function PublishedPlan({ pro }: { pro: Professional }) {
  const plan = findPlan(pro.plan ?? 'mensal')
  const price = `${formatMoney(plan.price)} ${plan.period}`
  return pro.trialEndsAt
    ? `Plano ${plan.label.toLowerCase()}: grátis até ${formatDate(pro.trialEndsAt)}, depois ${price}.`
    : `Plano ${plan.label.toLowerCase()}: ${price}.`
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

function SobreForm({ pro }: { pro: Professional }) {
  const [about, setAbout] = useState(pro.about ?? '')
  const [saved, setSaved] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateProfessional(pro.id, { about: about.trim() })
    setSaved(true)
  }

  return (
    <form className="page-section form" onSubmit={handleSubmit} onChange={() => setSaved(false)}>
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

      <SavedNote show={saved} />
      <div className="form-actions">
        <a className="clear-filters" href={routes.perfil(pro.id)}>
          Ver como os clientes veem
        </a>
        <button type="submit" className="login-button">
          Salvar
        </button>
      </div>
    </form>
  )
}

type Service = OfferedService & { id: string }

function ServicosForm({ pro, onChange }: { pro: Professional; onChange: () => void }) {
  const [services, setServices] = useState<Service[]>(() =>
    pro.services.map((service, index) => ({ ...service, id: `s${index}` })),
  )
  // id do serviço em edição, 'novo' ao adicionar, ou null
  const [editing, setEditing] = useState<string | null>(null)
  const [removed, setRemoved] = useState<{ service: Service; index: number } | null>(null)

  // Profissão já marcada num serviço novo: a do último serviço cadastrado
  const lastProfessionId = services.at(-1)?.professionId ?? professions[0].id

  // Agrupa por profissão, na ordem do catálogo
  const groups = professions
    .map((profession) => ({
      profession,
      items: services.filter((service) => service.professionId === profession.id),
    }))
    .filter(({ items }) => items.length > 0)

  // TODO: gravar as alterações de serviços no Supabase.
  function commit(next: Service[]) {
    setServices(next)
    updateProfessional(pro.id, {
      services: next.map(({ professionId, name, price }) => ({ professionId, name, price })),
    })
    onChange()
  }

  function save(service: Service) {
    commit(
      service.id
        ? services.map((item) => (item.id === service.id ? service : item))
        : [...services, { ...service, id: `s${Date.now()}` }],
    )
    setEditing(null)
  }

  function remove(service: Service) {
    setRemoved({ service, index: services.indexOf(service) })
    commit(services.filter(({ id }) => id !== service.id))
  }

  function undoRemove() {
    if (!removed) return
    const next = [...services]
    next.splice(removed.index, 0, removed.service)
    commit(next)
    setRemoved(null)
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
    <section className="page-section" aria-label="Meus serviços">
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
        </div>
      ))}

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
          service={{ id: '', professionId: lastProfessionId, name: '', price: null }}
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
  isDuplicate: (name: string, professionId: string, id: string) => boolean
  onSave: (service: Service) => void
  onCancel: () => void
}

function ServiceEditor({ service, isDuplicate, onSave, onCancel }: ServiceEditorProps) {
  const [professionId, setProfessionId] = useState(service.professionId)
  const [name, setName] = useState(service.name)
  const [price, setPrice] = useState(service.price == null ? '' : String(service.price))
  const [error, setError] = useState('')

  const suggestions = findProfession(professionId)?.tasks ?? []

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

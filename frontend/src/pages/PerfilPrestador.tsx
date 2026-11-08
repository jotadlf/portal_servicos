import { useState, type FormEvent } from 'react'
import { MapPin, Star } from 'lucide-react'
import { BlurredPrice, LoginBar } from '../components/LoginBar'
import { PageBar } from '../components/PageBar'
import { Rating } from '../components/Rating'
import { Avatar } from '../components/Avatar'
import { LoadError, Loading } from '../components/Status'
import {
  fetchMyReview,
  fetchProfessional,
  fetchReviews,
  perUnit,
  professionIdsOf,
  saveReview,
  talkOnWhatsapp,
  type MyReview,
  type Professional,
  type Review,
} from '../features/profissionais/prestadores'
import { fetchCatalog, findProfession } from '../features/servicos/catalogo'
import { useApi } from '../hooks/useApi'
import { routes } from '../hooks/useHashRoute'
import { errorMessage } from '../lib/api'
import { firstName, formatDate, formatPrice } from '../lib/format'

type PerfilPrestadorProps = {
  id: string
  isLoggedIn: boolean
  onLogin: () => void
}

// Rascunho só aparece para o próprio prestador: quem decide é o servidor
export function PerfilPrestador({ id, isLoggedIn, onLogin }: PerfilPrestadorProps) {
  const [noWhatsapp, setNoWhatsapp] = useState(false)
  const profile = useApi(
    () => Promise.all([fetchProfessional(id), fetchReviews(id), fetchCatalog()]),
    id,
  )
  // Sem login não há o que avaliar; erro aqui só esconde o formulário
  const mine = useApi<MyReview | null>(() => (isLoggedIn ? fetchMyReview(id) : Promise.resolve(null)), id)

  if (profile.loading && !profile.data) {
    return (
      <div className="app">
        <PageBar title="Prestador" />
        <main className="page">
          <Loading />
        </main>
      </div>
    )
  }

  const notFound = profile.status === 404
  if (!profile.data) {
    return (
      <div className="app">
        <PageBar title="Prestador" />
        <main className="page">
          {notFound ? (
            <div className="empty">
              <p>Não encontramos este prestador.</p>
              <a className="clear-filters" href={routes.inicio}>
                Voltar para o início
              </a>
            </div>
          ) : (
            <LoadError message={profile.error ?? ''} onRetry={profile.reload} />
          )}
        </main>
      </div>
    )
  }

  const [pro, comments, professions] = profile.data
  const professionNames = professionIdsOf(pro).map((pid) => findProfession(professions, pid)?.name ?? pid)
  const proFirstName = firstName(pro.name)
  const services = pro.services

  return (
    <div className="app">
      <PageBar title={professionNames[0] ?? 'Prestador'} />

      <main className="page">
        {pro.status === 'rascunho' && (
          <p className="notice">
            Rascunho: só você vê este perfil. Publique na aba{' '}
            <a href={routes.servicos}>Serviços</a> para aparecer nas buscas.
          </p>
        )}
        <section className="profile profile-page">
          <Avatar name={pro.name} photo={pro.photo} large />
          <div>
            <h1>{pro.name}</h1>
            <p className="sheet-profession">
              {new Intl.ListFormat('pt-BR').format(professionNames)}
            </p>
            <Rating rating={pro.rating} reviews={pro.reviews} />
            <span className="pro-place">
              <MapPin size={13} aria-hidden="true" /> {pro.neighborhood}
            </span>
          </div>
        </section>

        {pro.about && <p className="about">{pro.about}</p>}

        {!isLoggedIn && (
          <LoginBar
            id="contact-locked"
            message={`Entre para ver os preços e falar com ${proFirstName}.`}
            onLogin={onLogin}
          />
        )}

        <section className="page-section" aria-labelledby="servicos-title">
          <h2 id="servicos-title">Serviços</h2>
          <ul className="line-list">
            {services.map(({ professionId, name: task, price, unit, hidden }) => (
              <li key={`${professionId}-${task}`} className="line">
                <span>{task}</span>
                <span className="pro-price">
                  {hidden ? (
                    <>
                      <small>média</small>
                      <BlurredPrice />
                      <small>{perUnit(unit)}</small>
                    </>
                  ) : price == null ? (
                    <small>a combinar</small>
                  ) : (
                    <>
                      <small>média</small>
                      {formatPrice(price)}
                      <small>{perUnit(unit)}</small>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="section-note">
            Preços médios informados por {proFirstName}. O valor final é combinado na conversa.
          </p>
        </section>

        <section className="page-section" aria-labelledby="avaliacoes-title">
          <h2 id="avaliacoes-title">Avaliações</h2>
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
                  {review.comment && <p>{review.comment}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="section-note">Ainda sem comentários escritos.</p>
          )}
          {mine.data?.canReview && (
            <ReviewForm
              pro={pro}
              mine={mine.data.review}
              onSaved={({ review, rating, reviews }) => {
                profile.setData([
                  { ...pro, rating, reviews },
                  [review, ...comments.filter((other) => other.id !== review.id)],
                  professions,
                ])
                mine.setData({ own: false, canReview: true, review })
              }}
            />
          )}
          {mine.data && !mine.data.own && !mine.data.canReview && (
            <p className="section-note">
              Depois de falar com {proFirstName} pelo WhatsApp, você pode avaliar o serviço aqui.
            </p>
          )}
        </section>
      </main>

      <div className="bottom-bar">
        <div aria-live="polite">
          {noWhatsapp && (
            <p className="form-error">{proFirstName} ainda não cadastrou o WhatsApp.</p>
          )}
        </div>
        <button
          type="button"
          className="primary"
          disabled={!isLoggedIn}
          aria-describedby={isLoggedIn ? undefined : 'contact-locked'}
          onClick={() => {
            // Com o contato gravado, o formulário de avaliação aparece
            if (pro.whatsapp) talkOnWhatsapp(pro).then((saved) => saved && mine.reload())
            else setNoWhatsapp(true)
          }}
        >
          Falar com {proFirstName} no WhatsApp
        </button>
      </div>
    </div>
  )
}

type Saved = { review: Review; rating: number; reviews: number }

// Nota de 1 a 5 e comentário opcional. Quem já avaliou vê a própria avaliação e pode refazer.
function ReviewForm({ pro, mine, onSaved }: { pro: Professional; mine: Review | null; onSaved: (saved: Saved) => void }) {
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = firstName(pro.name)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (rating === 0) {
      setError('Escolha de 1 a 5 estrelas.')
      return
    }
    setBusy(true)
    try {
      onSaved(await saveReview(pro.id, rating, comment))
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="form review-form"
      onSubmit={handleSubmit}
      onChange={() => {
        setSent(false)
        setError('')
      }}
    >
      <fieldset className="star-input">
        <legend>{mine ? 'Sua avaliação' : `Como foi o serviço com ${name}?`}</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={n <= rating ? 'on' : undefined}>
            <input
              type="radio"
              name="rating"
              value={n}
              checked={rating === n}
              onChange={() => setRating(n)}
              className="visually-hidden"
            />
            <Star size={28} aria-hidden="true" />
            <span className="visually-hidden">
              {n} {n === 1 ? 'estrela' : 'estrelas'}
            </span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>Comentário (opcional)</span>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="Conte como foi: pontualidade, capricho, preço combinado."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>

      <div aria-live="polite">
        {error && <p className="form-error">{error}</p>}
        {sent && <p className="form-ready">Avaliação enviada. Obrigado!</p>}
      </div>
      <div className="form-actions">
        <button type="submit" className="login-button" disabled={busy}>
          {busy ? 'Enviando…' : mine ? 'Atualizar avaliação' : 'Enviar avaliação'}
        </button>
      </div>
    </form>
  )
}

import { useState } from 'react'
import { MapPin, Star } from 'lucide-react'
import { BlurredPrice, LoginBar } from '../components/LoginBar'
import { PageBar } from '../components/PageBar'
import { Rating } from '../components/Rating'
import { Avatar } from '../components/Avatar'
import {
  getProfessional,
  professionIdsOf,
  reviewsFor,
} from '../features/profissionais/dados-exemplo'
import { findProfession } from '../features/servicos/catalogo'
import { routes } from '../hooks/useHashRoute'
import { firstName, formatDate, formatPrice } from '../lib/format'
import { contactMessage, openWhatsapp } from '../lib/whatsapp'

type PerfilPrestadorProps = {
  id: string
  isLoggedIn: boolean
  // Rascunho só aparece para o próprio prestador
  isOwner: boolean
  onLogin: () => void
}

export function PerfilPrestador({ id, isLoggedIn, isOwner, onLogin }: PerfilPrestadorProps) {
  const [noWhatsapp, setNoWhatsapp] = useState(false)
  const found = getProfessional(id)
  const pro = found && (found.status === 'publicado' || isOwner) ? found : undefined

  if (!pro) {
    return (
      <div className="app">
        <PageBar title="Prestador" />
        <main className="page">
          <div className="empty">
            <p>Não encontramos este prestador.</p>
            <a className="clear-filters" href={routes.inicio}>
              Voltar para o início
            </a>
          </div>
        </main>
      </div>
    )
  }

  const professionNames = professionIdsOf(pro).map((id) => findProfession(id)?.name ?? id)
  const proFirstName = firstName(pro.name)
  // Sem login, só o primeiro nome
  const name = isLoggedIn ? pro.name : proFirstName
  const services = pro.services
  const comments = reviewsFor(pro.id)

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
          <Avatar name={name} photo={pro.photo} large />
          <div>
            <h1>{name}</h1>
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
            {services.map(({ professionId, name: task, price }) => (
              <li key={`${professionId}-${task}`} className="line">
                <span>{task}</span>
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
                  <p>{review.comment}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="section-note">Ainda sem comentários escritos.</p>
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
            // TODO: registrar o contato no Supabase para aparecer em "Contatos" do prestador.
            if (pro.whatsapp) openWhatsapp(pro.whatsapp, contactMessage(proFirstName))
            else setNoWhatsapp(true)
          }}
        >
          Falar com {proFirstName} no WhatsApp
        </button>
      </div>
    </div>
  )
}

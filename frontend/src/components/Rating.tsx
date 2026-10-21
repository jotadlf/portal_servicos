import { Star } from 'lucide-react'
import { formatRating } from '../lib/format'

type RatingProps = {
  rating: number
  reviews: number
}

export function Rating({ rating, reviews }: RatingProps) {
  return (
    <span className="pro-meta">
      <Star className="star" size={14} aria-hidden="true" />
      <span>
        <strong>{formatRating(rating)}</strong> <span className="visually-hidden">de 5, </span>(
        {reviews} {reviews === 1 ? 'avaliação' : 'avaliações'})
      </span>
    </span>
  )
}

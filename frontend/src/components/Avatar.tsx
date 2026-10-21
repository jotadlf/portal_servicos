import { initials } from '../lib/format'

type AvatarProps = {
  name: string
  photo?: string
  large?: boolean
}

// Foto da pessoa ou, sem foto, as iniciais do nome
export function Avatar({ name, photo, large }: AvatarProps) {
  return (
    <span className={`avatar${large ? ' avatar-large' : ''}`} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initials(name)}
    </span>
  )
}

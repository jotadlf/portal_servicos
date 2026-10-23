// Modalidades vêm do banco; aqui fica só a parte visual (ícone e imagem) de cada uma.
import {
  BrickWall,
  Droplets,
  Hammer,
  KeyRound,
  PaintRoller,
  Shirt,
  SprayCan,
  Sprout,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { api, fileToDataUrl } from '../../lib/api'
import eletricistaImg from '../../assets/profissoes/eletricista.png'
import faxineiraImg from '../../assets/profissoes/faxineira.png'
import diaristaImg from '../../assets/profissoes/diarista.svg'
import encanadorImg from '../../assets/profissoes/encanador.png'
import pedreiroImg from '../../assets/profissoes/pedreiro.png'
import pintorImg from '../../assets/profissoes/pintor.svg'
import montadorImg from '../../assets/profissoes/montador.png'
import jardineiroImg from '../../assets/profissoes/jardineiro.png'
import chaveiroImg from '../../assets/profissoes/chaveiro.png'

export type Profession = {
  id: string
  name: string
  icon: LucideIcon
  // Ícone 3D colorido usado nos cards de profissão. Modalidade nova pode vir sem:
  // aí o card mostra o ícone de linha.
  image?: string
  tasks: string[]
}

// Modalidades de fábrica; as criadas na administração usam a ferramenta e a imagem enviada
const visuals: Record<string, { icon: LucideIcon; image: string }> = {
  eletricista: { icon: Zap, image: eletricistaImg },
  faxineira: { icon: SprayCan, image: faxineiraImg },
  diarista: { icon: Shirt, image: diaristaImg },
  encanador: { icon: Droplets, image: encanadorImg },
  pedreiro: { icon: BrickWall, image: pedreiroImg },
  pintor: { icon: PaintRoller, image: pintorImg },
  montador: { icon: Hammer, image: montadorImg },
  jardineiro: { icon: Sprout, image: jardineiroImg },
  chaveiro: { icon: KeyRound, image: chaveiroImg },
}

type ProfessionData = { id: string; name: string; tasks: string[]; image?: string }

function withVisual(data: ProfessionData): Profession {
  const visual = visuals[data.id]
  return { ...data, icon: visual?.icon ?? Wrench, image: data.image ?? visual?.image }
}

export async function fetchCatalog() {
  return (await api<ProfessionData[]>('GET', '/api/catalogo')).map(withVisual)
}

export type Task = { title: string; profession: Profession }

export function getAllTasks(professions: Profession[]): Task[] {
  return professions.flatMap((profession) =>
    profession.tasks.map((title) => ({ title, profession })),
  )
}

export function findProfession(professions: Profession[], id: string) {
  return professions.find((profession) => profession.id === id)
}

// Só a administração consegue; o servidor confere
export async function addProfession({ name, tasks, image }: { name: string; tasks: string[]; image?: File }) {
  const data = await api<ProfessionData>('POST', '/api/catalogo', {
    name,
    tasks,
    image: image ? await fileToDataUrl(image) : undefined,
  })
  return withVisual(data)
}

// Os serviços da modalidade saem junto, de todos os perfis
export function removeProfession(id: string) {
  return api('DELETE', `/api/catalogo/${encodeURIComponent(id)}`)
}

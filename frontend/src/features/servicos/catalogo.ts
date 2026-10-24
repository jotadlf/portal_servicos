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
import { imageUrl, rpc, uploadImage } from '../../lib/api'
import { ICON } from '../../lib/imagem'
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
  // A imagem enviada vem do banco como caminho no Storage
  return { ...data, icon: visual?.icon ?? Wrench, image: imageUrl(data.image) ?? visual?.image }
}

export async function fetchCatalog() {
  return (await rpc<ProfessionData[]>('catalogo')).map(withVisual)
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

// Só a administração consegue; o banco confere (e o Storage só aceita a imagem dela)
export async function addProfession({ name, tasks, image }: { name: string; tasks: string[]; image?: File }) {
  const path = image ? await uploadImage('modalidades', image, 'image', ICON) : undefined
  const data = await rpc<ProfessionData>('adicionar_modalidade', { name, tasks, image: path })
  return withVisual(data)
}

// Os serviços da modalidade saem junto, de todos os perfis
export function removeProfession(id: string) {
  return rpc<void>('remover_modalidade', { id })
}

import {
  BrickWall,
  Droplets,
  Hammer,
  KeyRound,
  PaintRoller,
  Shirt,
  SprayCan,
  Sprout,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import eletricistaImg from '../../assets/profissoes/eletricista.png'
import faxineiraImg from '../../assets/profissoes/faxineira.png'
import diaristaImg from '../../assets/profissoes/diarista.png'
import encanadorImg from '../../assets/profissoes/encanador.png'
import pedreiroImg from '../../assets/profissoes/pedreiro.png'
import pintorImg from '../../assets/profissoes/pintor.png'
import montadorImg from '../../assets/profissoes/montador.png'
import jardineiroImg from '../../assets/profissoes/jardineiro.png'
import chaveiroImg from '../../assets/profissoes/chaveiro.png'

export type Profession = {
  id: string
  name: string
  icon: LucideIcon
  // Ícone 3D colorido (Fluent Emoji, licença MIT) usado nos cards de profissão
  image: string
  tasks: string[]
}

export const professions: Profession[] = [
  {
    id: 'eletricista',
    image: eletricistaImg,
    name: 'Eletricista',
    icon: Zap,
    tasks: ['Instalar chuveiro', 'Trocar tomada ou interruptor', 'Revisar quadro de energia'],
  },
  {
    id: 'faxineira',
    image: faxineiraImg,
    name: 'Faxineira',
    icon: SprayCan,
    tasks: ['Faxina completa', 'Limpeza pós-obra', 'Limpeza de vidros'],
  },
  {
    id: 'diarista',
    image: diaristaImg,
    name: 'Diarista',
    icon: Shirt,
    tasks: ['Diária de limpeza', 'Passar roupa', 'Organizar armários'],
  },
  {
    id: 'encanador',
    image: encanadorImg,
    name: 'Encanador',
    icon: Droplets,
    tasks: ['Consertar vazamento', 'Trocar torneira', 'Desentupir pia ou ralo'],
  },
  {
    id: 'pedreiro',
    image: pedreiroImg,
    name: 'Pedreiro',
    icon: BrickWall,
    tasks: ['Assentar piso', 'Rebocar parede', 'Pequena reforma'],
  },
  {
    id: 'pintor',
    image: pintorImg,
    name: 'Pintor',
    icon: PaintRoller,
    tasks: ['Pintar cômodo', 'Pintar portão', 'Aplicar textura'],
  },
  {
    id: 'montador',
    image: montadorImg,
    name: 'Montador',
    icon: Hammer,
    tasks: ['Montar guarda-roupa', 'Instalar painel de TV', 'Montar cozinha'],
  },
  {
    id: 'jardineiro',
    image: jardineiroImg,
    name: 'Jardineiro',
    icon: Sprout,
    tasks: ['Podar árvores', 'Plantar grama', 'Limpar lote'],
  },
  {
    id: 'chaveiro',
    image: chaveiroImg,
    name: 'Chaveiro',
    icon: KeyRound,
    tasks: ['Abrir porta', 'Trocar fechadura', 'Fazer cópia de chave'],
  },
]

export type Task = { title: string; profession: Profession }

export const allTasks: Task[] = professions.flatMap((profession) =>
  profession.tasks.map((title) => ({ title, profession })),
)

export function findProfession(id: string) {
  return professions.find((profession) => profession.id === id)
}

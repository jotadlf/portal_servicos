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

export type Profession = {
  id: string
  name: string
  icon: LucideIcon
  tasks: string[]
}

export const professions: Profession[] = [
  {
    id: 'eletricista',
    name: 'Eletricista',
    icon: Zap,
    tasks: ['Instalar chuveiro', 'Trocar tomada ou interruptor', 'Revisar quadro de energia'],
  },
  {
    id: 'faxineira',
    name: 'Faxineira',
    icon: SprayCan,
    tasks: ['Faxina completa', 'Limpeza pós-obra', 'Limpeza de vidros'],
  },
  {
    id: 'diarista',
    name: 'Diarista',
    icon: Shirt,
    tasks: ['Diária de limpeza', 'Passar roupa', 'Organizar armários'],
  },
  {
    id: 'encanador',
    name: 'Encanador',
    icon: Droplets,
    tasks: ['Consertar vazamento', 'Trocar torneira', 'Desentupir pia ou ralo'],
  },
  {
    id: 'pedreiro',
    name: 'Pedreiro',
    icon: BrickWall,
    tasks: ['Assentar piso', 'Rebocar parede', 'Pequena reforma'],
  },
  {
    id: 'pintor',
    name: 'Pintor',
    icon: PaintRoller,
    tasks: ['Pintar cômodo', 'Pintar portão', 'Aplicar textura'],
  },
  {
    id: 'montador',
    name: 'Montador',
    icon: Hammer,
    tasks: ['Montar guarda-roupa', 'Instalar painel de TV', 'Montar cozinha'],
  },
  {
    id: 'jardineiro',
    name: 'Jardineiro',
    icon: Sprout,
    tasks: ['Podar árvores', 'Plantar grama', 'Limpar lote'],
  },
  {
    id: 'chaveiro',
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

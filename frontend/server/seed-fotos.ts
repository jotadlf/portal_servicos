// Fotos fictícias dos prestadores de exemplo: avatares ilustrados gerados aqui mesmo,
// em PNG (o formato que a API aceita), sem baixar imagem de ninguém.
import { crc32, deflateSync } from 'node:zlib'

type Rgb = [number, number, number]

const backgrounds: Rgb[] = [
  [196, 229, 222], [243, 222, 170], [214, 222, 240], [240, 210, 200], [218, 234, 200], [228, 214, 236],
]
const skins: Rgb[] = [[241, 204, 174], [224, 172, 134], [198, 140, 100], [160, 106, 72], [120, 78, 52]]
const shirts: Rgb[] = [[8, 105, 95], [29, 43, 42], [155, 44, 31], [52, 88, 150], [190, 140, 30], [96, 70, 140]]

const SIZE = 160
// Cada pixel é a média de 3×3 amostras, para as bordas saírem lisas
const SAMPLES = 3

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width: number, height: number, rgb: Uint8Array) {
  // Cada linha começa com o byte do filtro (0 = nenhum)
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8 bits por canal, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Cor do ponto (x, y), com x e y de 0 a 1: fundo, ombros (roupa) e cabeça
function colorAt(x: number, y: number, bg: Rgb, skin: Rgb, shirt: Rgb): Rgb {
  const head = (x - 0.5) ** 2 + (y - 0.4) ** 2 < 0.18 ** 2
  if (head) return skin
  const neck = Math.abs(x - 0.5) < 0.07 && y > 0.5 && y < 0.7
  if (neck) return skin
  const shoulders = ((x - 0.5) / 0.38) ** 2 + ((y - 1.02) / 0.34) ** 2 < 1
  if (shoulders) return shirt
  return bg
}

export function avatarPng(index: number) {
  const bg = backgrounds[index % backgrounds.length]
  const skin = skins[(index * 3) % skins.length]
  const shirt = shirts[(index * 5 + 1) % shirts.length]
  const pixels = new Uint8Array(SIZE * SIZE * 3)
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colorAt((px + (sx + 0.5) / SAMPLES) / SIZE, (py + (sy + 0.5) / SAMPLES) / SIZE, bg, skin, shirt)
          sum[0] += c[0]
          sum[1] += c[1]
          sum[2] += c[2]
        }
      }
      const offset = (py * SIZE + px) * 3
      for (let c = 0; c < 3; c++) pixels[offset + c] = Math.round(sum[c] / SAMPLES ** 2)
    }
  }
  return encodePng(SIZE, SIZE, pixels)
}

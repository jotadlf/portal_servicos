// Reduz a imagem no navegador antes de enviar ao Storage: as fotos aparecem pequenas
// na tela (avatar de até 64px, ícone de modalidade de até 28px) e não precisam ocupar
// megabytes no bucket.

export type Compression = {
  // Maior lado, em pixels, depois de reduzir (com folga para telas de alta densidade)
  maxSide: number
  // Foto sem transparência: sem WebP no navegador, vira JPEG em vez de PNG
  opaque: boolean
}

// Avatar de 64px em tela 3x, com folga
export const PHOTO: Compression = { maxSide: 320, opaque: true }
// Ícone de 28px em tela 3x, com folga; mantém a transparência
export const ICON: Compression = { maxSide: 128, opaque: false }

const QUALITY = 0.8

export type Encoded = { bytes: Uint8Array; type: string }

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

// Devolve a imagem reduzida, ou undefined quando não dá para comprimir aqui (sem
// suporte no navegador, ou o resultado não ficaria menor): aí vai o arquivo original.
// Levanta erro se o navegador não conseguir abrir a imagem.
export async function compressImage(file: Blob, { maxSide, opaque }: Compression): Promise<Encoded | undefined> {
  if (typeof createImageBitmap !== 'function') return undefined
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return undefined
    if (opaque) {
      // Fundo branco: o JPEG não guarda transparência
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    // O Safari não gera WebP: devolve PNG no lugar
    let blob = await toBlob(canvas, 'image/webp')
    if (blob?.type !== 'image/webp') blob = await toBlob(canvas, opaque ? 'image/jpeg' : 'image/png')
    if (!blob || blob.size >= file.size) return undefined
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type }
  } finally {
    bitmap.close()
  }
}

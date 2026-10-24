// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressImage, ICON, PHOTO } from './imagem'

const original = new Blob([new Uint8Array(100_000)], { type: 'image/png' })

// Sem navegador: simula o canvas e o createImageBitmap
function fakeBrowser(width: number, height: number, encodes: (type: string) => string) {
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: vi.fn() }
  const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '', imageSmoothingQuality: '' }
  canvas.toBlob.mockImplementation((done: (blob: Blob) => void, type: string) =>
    done(new Blob([new Uint8Array(1_000)], { type: encodes(type) })),
  )
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close: vi.fn() })))
  vi.stubGlobal('document', { createElement: () => canvas })
  return { canvas, context }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('compressImage', () => {
  it('reduz a foto pelo maior lado e converte para WebP', async () => {
    const { canvas, context } = fakeBrowser(4000, 3000, (type) => type)
    const result = await compressImage(original, PHOTO)
    expect(result?.type).toBe('image/webp')
    expect([canvas.width, canvas.height]).toEqual([320, 240])
    // Foto: fundo branco por baixo
    expect(context.fillRect).toHaveBeenCalled()
  })

  it('sem WebP no navegador, foto vira JPEG e ícone continua PNG', async () => {
    fakeBrowser(1000, 1000, () => 'image/png')
    expect((await compressImage(original, PHOTO))?.type).toBe('image/png')

    const { canvas, context } = fakeBrowser(1000, 1000, (type) => (type === 'image/webp' ? 'image/png' : type))
    expect((await compressImage(original, ICON))?.type).toBe('image/png')
    expect(canvas.width).toBe(128)
    // Ícone mantém a transparência
    expect(context.fillRect).not.toHaveBeenCalled()

    fakeBrowser(1000, 1000, (type) => (type === 'image/webp' ? 'image/png' : type))
    expect((await compressImage(original, PHOTO))?.type).toBe('image/jpeg')
  })

  it('não amplia imagem pequena e mantém o original se não ficar menor', async () => {
    const { canvas } = fakeBrowser(50, 40, (type) => type)
    const tiny = new Blob([new Uint8Array(500)], { type: 'image/png' })
    expect(await compressImage(tiny, PHOTO)).toBeUndefined()
    expect([canvas.width, canvas.height]).toEqual([50, 40])
  })

  it('sem suporte no navegador, mantém o original', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    expect(await compressImage(original, PHOTO)).toBeUndefined()
  })
})

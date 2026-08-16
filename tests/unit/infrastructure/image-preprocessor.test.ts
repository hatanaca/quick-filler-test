import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { preprocessImage } from '@quickfiller/infrastructure'

/** Imagem 200x80: fundo branco, uma barra preta e uma barra vermelha. */
function makeImage(): Buffer {
  const canvas = createCanvas(200, 80)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, 200, 80)
  ctx.fillStyle = 'black'
  ctx.fillRect(20, 35, 60, 8)
  ctx.fillStyle = 'rgb(200, 40, 40)'
  ctx.fillRect(120, 35, 40, 8)
  return canvas.toBuffer('image/png')
}

async function pixels(buffer: Buffer): Promise<Uint8ClampedArray> {
  const image = await loadImage(buffer)
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, image.width, image.height).data
}

describe('preprocessImage', () => {
  it('"off" devolve o buffer original', async () => {
    const img = makeImage()
    const out = await preprocessImage(img, 'off')
    expect(out.equals(img)).toBe(true)
  })

  it('"grayscale" binariza — saída só tem pixels 0 ou 255', async () => {
    const out = await preprocessImage(makeImage(), 'grayscale')
    const data = await pixels(out)
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i])
    }
  })

  it('"auto" detecta tinta vermelha e preserva a barra vermelha como preto', async () => {
    const out = await preprocessImage(makeImage(), 'auto')
    const image = await loadImage(out)
    const canvas = createCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    const data = ctx.getImageData(0, 0, image.width, image.height).data

    // A barra vermelha (x≈120-160, y≈35-43) deve conter pixels pretos na saída.
    let blackInRed = 0
    for (let y = 30; y < 50; y++) {
      for (let x = 110; x < 170; x++) {
        if (data[(y * image.width + x) * 4] === 0) blackInRed++
      }
    }
    expect(blackInRed).toBeGreaterThan(50)
  })

  it('não quebra imagem sem tinta vermelha (auto → grayscale)', async () => {
    const canvas = createCanvas(100, 40)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 100, 40)
    ctx.fillStyle = 'black'
    ctx.fillRect(30, 15, 40, 8)

    const out = await preprocessImage(canvas.toBuffer('image/png'), 'auto')
    const data = await pixels(out)
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i])
    }
  })
})

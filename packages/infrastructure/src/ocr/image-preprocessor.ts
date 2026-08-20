import { loadImage, createCanvas } from '@napi-rs/canvas'

export type PreprocessMode = 'off' | 'auto' | 'color' | 'grayscale'

/**
 * Pré-processa um PNG antes de enviar ao Tesseract para melhorar a legibilidade.
 *
 * - "off": retorna o buffer original sem modificação.
 * - "grayscale": converte para cinza, aplica contraste e binarização Otsu.
 * - "color": extrai o canal vermelho (carimbos vermelhos em fundo branco),
 *   depois binariza. Ideal para time-card-04 (carimbos vermelhos desbotados).
 * - "auto": grayscale por padrão (funciona bem para a maioria dos documentos).
 */
export async function preprocessImage(
  buffer: Buffer,
  mode: PreprocessMode = 'auto',
): Promise<Buffer> {
  if (mode === 'off') return buffer

  const image = await loadImage(buffer)
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, image.width, image.height)
  const data = imageData.data

  // "auto" detecta tinta vermelha (carimbos) — caso contrário grayscale.
  const effective = mode === 'auto' ? (hasRedInk(data) ? 'color' : 'grayscale') : mode

  if (effective === 'color') {
    extractRedChannel(data)
  } else {
    toGrayscale(data)
  }

  enhanceContrast(data)
  let binary = sauvolaThreshold(data, image.width, image.height)

  const skew = detectSkew(binary, image.width, image.height)
  if (Math.abs(skew) > 0.3) {
    const rotated = rotateGray(data, image.width, image.height, -skew)
    data.set(rotated)
    binary = sauvolaThreshold(data, image.width, image.height)
  }

  applyBinary(data, binary)

  // putImageData copia os pixels para o canvas — DEVE vir depois de todas as
  // transformações, senão o thresholding não chega ao buffer de saída.
  ctx.putImageData(imageData, 0, 0)

  return canvas.toBuffer('image/png')
}

/**
 * Detecta tinta vermelha/rosa: fração de pixels onde R é claramente maior que
 * G e B. Carimbos vermelhos em fundo branco são o caso do time-card-04; em
 * grayscale essa tinta vira o mesmo tom do fundo e some.
 */
function hasRedInk(data: Uint8ClampedArray): boolean {
  let red = 0
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    // Vermelho "puro" e suficientemente forte (não é cinza/roxo/marrom).
    // 1.2× tolera rosa desbotado (carimbo) onde R é só ~20% maior que G/B.
    if (r > 100 && r > g * 1.2 && r > b * 1.2) red++
    total++
  }
  return total > 0 && red / total > 0.02
}

/** Extrai canal vermelho: "redness" = quanto R excede G/B; inverte e amplifica. */
function extractRedChannel(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    // Vermelho/rosa tem R > max(G,B); cinza/branco/azul têm redness <= 0.
    const redness = r - Math.max(g, b)
    const gray = 255 - Math.max(0, redness) * 4
    const clamped = Math.max(0, Math.min(255, gray))
    data[i] = clamped
    data[i + 1] = clamped
    data[i + 2] = clamped
  }
}

function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    // Fórmula perceptual padrão (ITU-R BT.601).
    const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114)
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }
}

/** Aumenta contraste via stretching linear (1%–99%). */
function enhanceContrast(data: Uint8ClampedArray): void {
  const histogram = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] ?? 0
    histogram[val] = (histogram[val] ?? 0) + 1
  }

  const total = data.length / 4
  const cutLow = Math.floor(total * 0.01)
  const cutHigh = Math.floor(total * 0.99)

  let low = 0,
    cumLow = 0,
    high = 255,
    cumHigh = 0
  while (low < 255) {
    cumLow += histogram[low]!
    if (cumLow >= cutLow) break
    low++
  }
  while (high > 0) {
    cumHigh += histogram[high]!
    if (cumHigh >= cutHigh) break
    high--
  }

  if (low >= high) return
  const range = high - low

  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] ?? 0
    const adjusted = ((val - low) / range) * 255
    const clamped = Math.max(0, Math.min(255, Math.round(adjusted)))
    data[i] = clamped
    data[i + 1] = clamped
    data[i + 2] = clamped
  }
}

/**
 * Limiarização adaptativa de Sauvola (local): lida com iluminação irregular e
 * regiões desbotadas melhor que o limiar global de Otsu. Usa imagens integrais
 * para O(1) por pixel — essencial em páginas grandes (scale=4 ≈ 8M px).
 */
function sauvolaThreshold(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const w = width
  const h = height
  const size = w * h

  const gray = new Float64Array(size)
  for (let i = 0; i < size; i++) gray[i] = data[i * 4] ?? 0

  const integral = new Float64Array((w + 1) * (h + 1))
  const integralSq = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    let rowSq = 0
    const rowOff = y * w
    const intOff = (y + 1) * (w + 1)
    const intPrev = y * (w + 1)
    for (let x = 0; x < w; x++) {
      const v = gray[rowOff + x] ?? 0
      rowSum += v
      rowSq += v * v
      const idx = intOff + x + 1
      integral[idx] = (integral[intPrev + x + 1] ?? 0) + rowSum
      integralSq[idx] = (integralSq[intPrev + x + 1] ?? 0) + rowSq
    }
  }

  // Janela local (metade do lado); R = 128 (desvio padrão típico de cinza).
  const r = 15
  const k = 0.5
  const R = 128

  const out = new Uint8Array(size)
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - r)
    const y2 = Math.min(h - 1, y + r)
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - r)
      const x2 = Math.min(w - 1, x + r)

      const a = integral[y1 * (w + 1) + x1] ?? 0
      const b = integral[y1 * (w + 1) + x2 + 1] ?? 0
      const c = integral[(y2 + 1) * (w + 1) + x1] ?? 0
      const d = integral[(y2 + 1) * (w + 1) + x2 + 1] ?? 0
      const sum = d - b - c + a

      const a2 = integralSq[y1 * (w + 1) + x1] ?? 0
      const b2 = integralSq[y1 * (w + 1) + x2 + 1] ?? 0
      const c2 = integralSq[(y2 + 1) * (w + 1) + x1] ?? 0
      const d2 = integralSq[(y2 + 1) * (w + 1) + x2 + 1] ?? 0
      const sumSq = d2 - b2 - c2 + a2

      const area = (y2 - y1 + 1) * (x2 - x1 + 1)
      const mean = sum / area
      const variance = sumSq / area - mean * mean
      const std = Math.sqrt(Math.max(0, variance))
      const threshold = mean * (1 + k * (std / R - 1))

      const v = gray[y * w + x] ?? 0
      out[y * w + x] = v < threshold ? 0 : 255
    }
  }

  return out
}

/** Escreve o resultado binário (0/255 por pixel) de volta no RGBA. */
function applyBinary(data: Uint8ClampedArray, binary: Uint8Array): void {
  for (let i = 0; i < binary.length; i++) {
    const v = binary[i] ?? 0
    const offset = i * 4
    data[offset] = v
    data[offset + 1] = v
    data[offset + 2] = v
  }
}

/**
 * Estima o ângulo de skew (graus, positivo = horário) por projeção: para cada
 * ângulo candidato aplica um shear `row = y - x·tan(θ)` e mede a variância do
 * histograma de linhas. O ângulo que deixa o perfil mais "pontiagudo" é o skew.
 */
function detectSkew(binary: Uint8Array, width: number, height: number): number {
  const blackIndices: number[] = []
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === 0) blackIndices.push(i)
  }
  if (blackIndices.length === 0) return 0

  // Sample for large images to bound CPU work
  const MAX_SAMPLES = 10_000
  const step = Math.max(1, Math.floor(blackIndices.length / MAX_SAMPLES))

  let bestAngle = 0
  let bestVariance = -1
  for (let angle = -5; angle <= 5; angle += 0.5) {
    const tan = Math.tan((angle * Math.PI) / 180)
    const hist = new Float64Array(height)
    for (let i = 0; i < blackIndices.length; i += step) {
      const idx = blackIndices[i]!
      const x = idx % width
      const y = (idx - x) / width
      const row = Math.round(y - x * tan)
      if (row >= 0 && row < height) hist[row] = (hist[row] ?? 0) + 1
    }

    let mean = 0
    for (let i = 0; i < height; i++) mean += hist[i] ?? 0
    mean /= height

    let variance = 0
    for (let i = 0; i < height; i++) {
      const diff = (hist[i] ?? 0) - mean
      variance += diff * diff
    }

    if (variance > bestVariance) {
      bestVariance = variance
      bestAngle = angle
    }
  }
  return bestAngle
}

/** Rotaciona a imagem em cinza por `angleDeg` (vizinho mais próximo, fundo branco). */
function rotateGray(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  angleDeg: number,
): Uint8ClampedArray {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = width / 2
  const cy = height / 2
  const out = new Uint8ClampedArray(data.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      const dy = y - cy
      const sx = Math.round(cos * dx + sin * dy + cx)
      const sy = Math.round(-sin * dx + cos * dy + cy)
      const dst = (y * width + x) * 4
      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        const src = (sy * width + sx) * 4
        out[dst] = data[src] ?? 255
        out[dst + 1] = data[src + 1] ?? 255
        out[dst + 2] = data[src + 2] ?? 255
        out[dst + 3] = 255
      } else {
        out[dst] = 255
        out[dst + 1] = 255
        out[dst + 2] = 255
        out[dst + 3] = 255
      }
    }
  }
  return out
}

/**
 * Valida que o arquivo é realmente um PDF (magic bytes "%PDF" nos
 * primeiros 4 bytes). Não confia em extensão ou MIME do cliente.
 */
export function isPdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 5) return false
  const header = buffer.subarray(0, 5).toString('latin1')
  return header === '%PDF-'
}

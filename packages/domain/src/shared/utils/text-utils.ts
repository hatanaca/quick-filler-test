/** Remove acentos (NFD), colapsa whitespace, lowercase. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** Formata número com 2 dígitos (zero-padded). */
export function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

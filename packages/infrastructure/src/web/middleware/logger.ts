const PII_PATTERNS: { label: string; regex: RegExp }[] = [
  // CPF (11 dígitos com pontuação)
  { label: '[CPF]', regex: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
  // Matrícula com padrão numérico longo
  { label: '[MATRICULA]', regex: /\b\d{6,}\b/g },
  // Email
  { label: '[EMAIL]', regex: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
]

function redactPii(value: unknown): unknown {
  if (typeof value === 'string') {
    let redacted = value
    for (const { label, regex } of PII_PATTERNS) {
      redacted = redacted.replace(regex, label)
    }
    return redacted
  }
  if (value && typeof value === 'object') {
    // headers chega como objeto — redige cada valor string, não o objeto inteiro
    const redacted: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = redactPii(entry)
    }
    return redacted
  }
  return value
}

/**
 * Opções do logger com redação de PII: CPF, matrícula e e-mails nunca
 * aparecem nos logs — requisito do desafio (sem PII nos logs).
 */
export function createLoggerOptions(level = 'info') {
  return {
    level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie'],
      censor: '[REDACTED]',
    },
    serializers: {
      req(req: { method?: string; url?: string; ip?: string; headers?: unknown }) {
        return {
          method: req.method,
          url: redactPii(req.url) as string,
          ip: redactPii(req.ip) as string,
          headers: redactPii(req.headers),
        }
      },
      res(res: { statusCode?: number }) {
        return { statusCode: res.statusCode }
      },
      err(err: { type?: string; message?: string; stack?: string }) {
        // Redact stack traces in production to prevent leaking internal paths
        const isProd = process.env.NODE_ENV === 'production'
        return {
          type: err.type ?? 'Error',
          message: redactPii(err.message),
          ...(isProd ? {} : { stack: err.stack }),
        }
      },
    },
  }
}

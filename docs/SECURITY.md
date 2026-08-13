# Segurança e Privacidade / Security & Privacy (PT-BR / EN)

## Português

### Upload

| Medida | Detalhe |
|--------|---------|
| Limite de tamanho | 20MB (configurável via `UPLOAD_MAX_SIZE_MB`) |
| Validação | Magic bytes `%PDF` nos primeiros 5 bytes — extensão/MIME não são confiáveis |
| Nome sanitizado | Arquivo salvo como `<uuid>.pdf` — nome original (PII) descartado |
| Uploads simultâneos | Limite por IP configurável (`UPLOAD_MAX_CONCURRENT_PER_IP`, padrão 3) |
| PDF corrompido | Processamento falha → `status: "erro"` com mensagem legível |
| PDF gigante | Rejeitado com 4xx no upload |

### Política de retenção

- **O que guarda**: o PDF enviado e a transcrição em memória
- **Onde**: arquivos em `uploads/` (volume Docker), transcrições no repositório em memória
- **Por quanto tempo**: uploads deletados após `RETENTION_MINUTES` (padrão 60min)
  pelo cleanup service; transcrições expiradas removidas junto
- **Nunca**: PII em logs, nomes originais de arquivo, dados além do necessário

### PII em logs

Redação automática no logger (pino): CPF (`000.000.000-00`), matrículas
numéricas longas, e-mails e headers sensíveis (`authorization`, `cookie`)
substituídos por `[REDACTED]`/`[CPF]`/`[EMAIL]`.

### API

- Helmet (headers de segurança, CSP)
- CORS com origin whitelist (`CORS_ORIGIN`, suporta múltiplas separadas por vírgula)
- Rate limit por IP (`RATE_LIMIT_MAX`, padrão 100/min)
- Validação de entrada com Zod/VOs de domínio em todas as rotas
- **IDs de transcrição validados como UUID** — impede path traversal via
  `TranscriptionId` em caminhos de arquivo (`uploads/<id>.pdf`) e em headers
  (`Content-Disposition`)
- `trustProxy: 'loopback'` — `X-Forwarded-*` só é confiado a proxies locais
  (ex.: nginx no Docker), impedindo spoofing de IP para contornar rate limit
- Erros de domínio → 400 com mensagem; erros inesperados → 500 genérico
  (sem stack trace em produção)

### Docker

- `USER node` — container não roda como root
- Multi-stage: imagem de produção sem ferramentas de build
- `.env` nunca entra na imagem; use `--env-file` ou secrets
- Healthcheck em `/healthz`

### Dependências

- `npm audit` no CI falha com vulnerabilidades high/critical
- Dependabot atualiza dependências semanalmente
- Lockfile commitado

## English

### Upload

| Measure | Detail |
|---------|--------|
| Size limit | 20MB (configurable via `UPLOAD_MAX_SIZE_MB`) |
| Validation | `%PDF` magic bytes in the first 5 bytes — extension/MIME are not trusted |
| Sanitized name | File saved as `<uuid>.pdf` — original name (PII) discarded |
| Concurrent uploads | Per-IP limit configurable (`UPLOAD_MAX_CONCURRENT_PER_IP`, default 3) |
| Corrupted PDF | Processing fails → `status: "erro"` with a readable message |
| Oversized PDF | Rejected with 4xx at upload |

### Retention policy

- **What is stored**: the uploaded PDF and the transcription in memory
- **Where**: files in `uploads/` (Docker volume), transcriptions in the in-memory repository
- **For how long**: uploads deleted after `RETENTION_MINUTES` (default 60min)
  by the cleanup service; expired transcriptions removed as well
- **Never**: PII in logs, original file names, data beyond what is needed

### PII in logs

Automatic redaction in the logger (pino): CPF (`000.000.000-00`), long numeric
registration numbers, emails and sensitive headers (`authorization`, `cookie`)
replaced with `[REDACTED]`/`[CPF]`/`[EMAIL]`.

### API

- Helmet (security headers, CSP)
- CORS with origin whitelist (`CORS_ORIGIN`, comma-separated multiple origins)
- Per-IP rate limit (`RATE_LIMIT_MAX`, default 100/min)
- Input validation with Zod/domain VOs on all routes
- **Transcription IDs validated as UUID** — prevents path traversal via
  `TranscriptionId` in file paths (`uploads/<id>.pdf`) and in headers
  (`Content-Disposition`)
- `trustProxy: 'loopback'` — `X-Forwarded-*` is only trusted from local
  proxies (e.g. nginx in Docker), preventing IP spoofing to bypass rate limits
- Domain errors → 400 with message; unexpected errors → generic 500
  (no stack trace in production)

### Docker

- `USER node` — container does not run as root
- Multi-stage: production image without build tooling
- `.env` never enters the image; use `--env-file` or secrets
- Healthcheck at `/healthz`

### Dependencies

- `npm audit` in CI fails on high/critical vulnerabilities
- Dependabot updates dependencies weekly
- Committed lockfile

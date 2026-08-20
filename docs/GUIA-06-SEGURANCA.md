# 6. Segurança e Testes

> [← Voltar ao índice](GUIA.md)

## 6.1 Segurança

### Upload Validation

- **Magic bytes `%PDF-`:** Primeiros 5 bytes do arquivo. Se não for `%PDF-`, rejeita. Nunca confia em extensão (.pdf) ou MIME type (application/pdf) — podem ser falsificados.
- **Limite de 20MB:** Protege contra uploads gigantes que esgotariam memória/disco.

### Nomes de Arquivo

- **UUID no filesystem:** O arquivo é salvo como `<uuid>.pdf`, não como `documento_original.pdf`. Isso impede:
  - Path traversal (`../../etc/passwd`).
  - PII (informações pessoais) no nome do arquivo.

### Autenticação

- **JWT Bearer tokens** para autenticação da API. Endpoints requerem header
  `Authorization: Bearer <token>` (exceto `/healthz` e rotas de auth).
- **Refresh tokens** em cookies httpOnly (secure em HTTPS) com rotação.
- **Senhas** hasheadas com `scrypt` + salt aleatório de 16 bytes; comparação
  timing-safe (`crypto.timingSafeEqual`) para prevenir timing attacks.
- Rotas de auth: `POST /api/auth/login`, `/refresh`, `/logout`,
  `GET /api/auth/me`.

### Rate Limiting

- **300 req/min por IP (padrão):** Impede abuso da API. Configurável via
  `RATE_LIMIT_MAX`.
- **Helmet:** Headers de segurança HTTP (X-Content-Type-Options, X-Frame-Options, etc.).
- **CORS:** Whitelist de origens permitidas (padrão: `http://localhost:5173`).

### Trust Proxy

- **`trustProxy: 'loopback'`:** Confia em `X-Forwarded-*` apenas de proxies loopback (ex: nginx no Docker).
- Se fosse `true` (qualquer proxy), qualquer cliente poderia spoofear o IP e contornar rate limiting.

### PII nos Logs

- CPF, matrícula, e-mail são redigidos nos logs para evitar vazamento de dados pessoais.

### Retenção

- Transcrições expiram após 60 minutos (configurável).
- Cleanup timer remove do repositório E do disco.
- Timer usa `Math.min(retentionMs, 60_000)` — roda no máximo a cada 60s.

### Container

- Dockerfile roda como usuário não-root.
- Healthcheck via `wget` (não curl — menor ataque de superfície).

---

## 6.2 Estrutura de Testes (TDD)

### Abordagem TDD

O projeto segue TDD (Test-Driven Development) para domain e application:

1. Escreve teste primeiro.
2. Roda teste (falha).
3. Implementa código mínimo para passar.
4. Refatora.

### Estrutura

```
tests/
├── unit/
│   ├── domain/          ← Testes puros, sem mocks
│   │   ├── extractors.test.ts      ← Testa CartaoPontoExtractor e HoleriteExtractor
│   │   ├── shared/                 ← Testa date-utils, domain errors
│   │   ├── spreadsheet/            ← Testa SpreadsheetBuilder, HighlightDetector
│   │   └── transcription/          ← Testa entidades, value objects, services
│   └── application/     ← Testes com mocks nos ports
│       ├── create-transcription.test.ts
│       ├── process-transcription.test.ts
│       ├── get-transcription.test.ts
│       ├── update-transcription.test.ts
│       ├── export-spreadsheet.test.ts
│       └── result-parser.test.ts
├── integration/
│   ├── api.test.ts           ← Testa rotas HTTP (cria servidor Fastify real)
│   ├── pipeline.test.ts      ← Pipeline E2E com PDFs reais
│   └── upload-security.test.ts ← Testa validações de upload
└── fixtures/
    └── pdfs/                 ← PDFs sintéticos gerados para testes
```

### Cobertura

- **Domain: ≥ 90%** (branches, functions, lines) — é o coração do projeto, precisa de cobertura alta.
- **Application: ≥ 80%** — use cases são orquestração, menos branches.

### Diferença entre Unit e Integration

**Unit tests (domain):**

- Testam value objects, entidades, extratores isoladamente.
- Sem mocks, sem HTTP, sem banco.
- Ex: `Money.from("2.389,77")` deve retornar Money válido.

**Unit tests (application):**

- Testam use cases com mocks nos ports.
- Ex: `CreateTranscriptionUseCase` com `MockRepository` e `MockStorage`.

**Integration tests:**

- Testam o sistema real (HTTP + use cases + adapters).
- Ex: Fazer POST real, verificar response 202, fazer GET, verificar status.

---

> [← Decisões e Padrões](GUIA-05-DECISOES.md) | [Referência →](GUIA-07-REFERENCIA.md)

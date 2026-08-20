# Arquitetura / Architecture (PT-BR / EN)

## Português

### Visão geral

A aplicação segue Domain-Driven Design com Ports & Adapters (Hexagonal):
o núcleo de negócio (`domain`) é puro e não conhece frameworks; a camada de
aplicação orquestra use cases; a infraestrutura implementa os ports
(HTTP, OCR, PDF, planilhas, persistência).

### Bounded Contexts

| Contexto          | Responsabilidade                                                 | Aggregate Root                  |
| ----------------- | ---------------------------------------------------------------- | ------------------------------- |
| **Transcription** | Upload, processamento (texto/OCR), extração, revisão             | `Transcription`                 |
| **Spreadsheet**   | Transposição do resultado para a forma de planilha com destaques | `SpreadsheetExport` (stateless) |

### Camadas

```
domain         → (zero dependências externas — TypeScript puro)
application    → domain (use cases, DTOs, event bus)
infrastructure → application + domain (Fastify, Tesseract, pdfjs, ExcelJS, DI manual)
frontend       → independente (fala com a API via HTTP)
```

**NUNCA**: `domain` importa `infrastructure`/`application`;
`application` importa `infrastructure` (usa apenas ports).

### Autenticação

Todas as rotas de transcrição requerem JWT Bearer token (exceto `/healthz` e
rotas de auth). Login via `POST /api/auth/login` retorna access token + refresh
token em cookie httpOnly.

### Fluxo de uma transcrição

1. `POST /api/transcricoes` (infrastructure) valida JWT + upload (magic bytes, limite)
2. `CreateTranscriptionUseCase` (application) cria a entidade `Transcription`
3. Processamento assíncrono (nunca dentro do request):
   `ProcessTranscriptionUseCase` → `PdfExtractorPort.extractPages` →
   se página sem texto → `OcrEnginePort.recognize` (Tesseract) →
   `CartaoPontoExtractor`/`HoleriteExtractor` (domain) → `transcription.complete(result)`
4. `GET /api/transcricoes/:id` retorna status + value (polling no frontend)
5. `PUT` substitui o value com as correções; `GET /planilha` transpõe e exporta

### Regras de domínio críticas (testadas)

- Valores monetários são **string** no formato brasileiro — nunca float
- `date_raw`/`time_raw` preservam o documento; `time_hhmm` normaliza
- Caractere não lido → `?` (incerteza por caractere, nunca inventar valor)
- Datas impossíveis (38/07) = erro de leitura, nunca uma data
- Avisos são **derivados** na hora de exibir (nunca armazenados):
  batidas ímpares, data/mês não sequencial, página vazia, `?`
- Dezembro → janeiro é consecutivo; competência ilegível não quebra a cadeia
- Ordem do documento preservada — nunca ordenar por data
- `fields` ≠ `bases` no holerite (separação é a decisão central)
- Cores da planilha: amarelo `#FFF3CD` (aviso), vermelho `#F8D7DA` + borda
  `#DC3545` (erro); vermelho ganha

### Decisões

| Decisão                | Alternativa   | Por quê                                                |
| ---------------------- | ------------- | ------------------------------------------------------ |
| Fastify                | Express       | Mais rápido, tipado, schema validation                 |
| Tesseract.js local     | Google Vision | Sem custo, sem API key, offline                        |
| Polling (2s)           | SSE/WebSocket | Simples e suficiente para o contrato                   |
| In-memory repository   | Banco         | Retenção curta; trocar implementando o port            |
| DI manual              | NestJS/typedi | Sem framework, suficiente para o tamanho               |
| JWT + httpOnly cookies | Session store | Stateless, funciona atrás de proxies, refresh rotation |

## English

### Overview

The application follows Domain-Driven Design with Ports & Adapters
(Hexagonal): the business core (`domain`) is pure and framework-free; the
application layer orchestrates use cases; the infrastructure implements the
ports (HTTP, OCR, PDF, spreadsheets, persistence).

### Bounded Contexts

| Context           | Responsibility                                                    | Aggregate Root                  |
| ----------------- | ----------------------------------------------------------------- | ------------------------------- |
| **Transcription** | Upload, processing (text/OCR), extraction, review                 | `Transcription`                 |
| **Spreadsheet**   | Transposition of the result into spreadsheet form with highlights | `SpreadsheetExport` (stateless) |

### Layers

```
domain         → (zero external dependencies — pure TypeScript)
application    → domain (use cases, DTOs, event bus)
infrastructure → application + domain (Fastify, Tesseract, pdfjs, ExcelJS, manual DI)
frontend       → independent (talks to the API over HTTP)
```

**NEVER**: `domain` imports `infrastructure`/`application`;
`application` imports `infrastructure` (ports only).

### Authentication

All transcription routes require a JWT Bearer token (except `/healthz` and
auth routes). Login via `POST /api/auth/login` returns access token + refresh
token in httpOnly cookie.

### Transcription flow

1. `POST /api/transcricoes` (infrastructure) validates JWT + upload (magic bytes, limit)
2. `CreateTranscriptionUseCase` (application) creates the `Transcription` entity
3. Async processing (never inside the request):
   `ProcessTranscriptionUseCase` → `PdfExtractorPort.extractPages` →
   if a page has no text → `OcrEnginePort.recognize` (Tesseract) →
   `CartaoPontoExtractor`/`HoleriteExtractor` (domain) → `transcription.complete(result)`
4. `GET /api/transcricoes/:id` returns status + value (frontend polling)
5. `PUT` replaces the value with corrections; `GET /planilha` transposes and exports

### Critical domain rules (tested)

- Money values are **strings** in Brazilian format — never floats
- `date_raw`/`time_raw` preserve the document; `time_hhmm` normalizes
- Unreadable character → `?` (per-character uncertainty, never invent values)
- Impossible dates (38/07) mean reading errors, never a date
- Warnings are **derived** at display time (never stored):
  odd punches, non-sequential date/month, empty page, `?`
- December → January is consecutive; unreadable competence does not break the chain
- Document order preserved — never sort by date
- `fields` ≠ `bases` in pay stubs (separation is the central decision)
- Spreadsheet colors: yellow `#FFF3CD` (warning), red `#F8D7DA` + left border
  `#DC3545` (error); red wins

### Decisions

| Decision               | Alternative   | Why                                               |
| ---------------------- | ------------- | ------------------------------------------------- |
| Fastify                | Express       | Faster, typed, schema validation                  |
| Local Tesseract.js     | Google Vision | No cost, no API key, offline                      |
| Polling (2s)           | SSE/WebSocket | Simple and sufficient for the contract            |
| In-memory repository   | Database      | Short retention; swap by implementing the port    |
| Manual DI              | NestJS/typedi | Framework-free, enough for this size              |
| JWT + httpOnly cookies | Session store | Stateless, works behind proxies, refresh rotation |

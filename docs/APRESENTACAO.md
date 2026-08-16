# Referência completa para apresentação — Quick Filler v1.1.0

## 1. O que é o projeto

**Quick Filler** é uma aplicação web que transcreve documentos trabalhistas
brasileiros (cartões de ponto e holerites) de PDF para planilhas estruturadas
(XLSX, CSV, JSON). Pipeline completo: upload do PDF → OCR/processamento →
tabela editável de revisão → download da planilha.

**Stack**: Node.js/TypeScript, Fastify, React 18, Vite, Vitest, Docker.
**Arquitetura**: DDD com Ports & Adapters (Hexagonal), monorepo npm workspaces.

---

## 2. Arquitetura — visão geral

```
packages/
  domain/            ← puro, zero deps externas
    shared/            (errors, events, date-utils)
    transcription/     (entity, VOs, ports, extractors, services)
    spreadsheet/       (VOs, ports, SpreadsheetBuilder, HighlightDetector)
  application/       ← depende apenas de domain
    transcription/     (use-cases: Create, Process, Get, Update)
    spreadsheet/       (use-case: Export)
    shared/            (InMemoryEventBus)
  infrastructure/    ← implementa os ports (Fastify, pdfjs, Tesseract, ExcelJS)
    web/               (server, routes, middleware, config)
    pdf/               (PdfJsExtractorAdapter)
    ocr/               (TesseractOcrAdapter)
    exporters/         (ExcelJsGeneratorAdapter)
    persistence/       (InMemoryTranscriptionRepository, DiskFileStorage)
    di/                (container.ts — DI manual)
  frontend/          ← React SPA
    components/        (Upload, ReviewTable, PdfViewer, DownloadButton)
    hooks/             (useTranscricao, useUpload)
    api/               (client.ts)
```

### 2.1 Dois Bounded Contexts

| Contexto          | Responsabilidade                                                     |
| ----------------- | -------------------------------------------------------------------- |
| **Transcription** | Upload, parsing, OCR, revisão, estados (PROCESSANDO→CONCLUIDO\|ERRO) |
| **Spreadsheet**   | Exportação, warnings, highlights, formatação                         |

### 2.2 Ports & Adapters

A camada **domain** define interfaces (ports) que a **infrastructure** implementa:

| Port                       | Implementação                                          |
| -------------------------- | ------------------------------------------------------ |
| `TranscriptionRepository`  | `InMemoryTranscriptionRepository` (Map em memória)     |
| `FileStoragePort`          | `DiskFileStorage` (`uploads/<uuid>.pdf`)               |
| `PdfExtractorPort`         | `PdfJsExtractorAdapter` (pdfjs-dist + @napi-rs/canvas) |
| `OcrEnginePort`            | `TesseractOcrAdapter` (tesseract.js, lazy worker)      |
| `SpreadsheetGeneratorPort` | `ExcelJsGeneratorAdapter` (ExcelJS)                    |

Domain **nunca** importa infrastructure. Adapters são injetados via construtor.

### 2.3 DI Manual (container.ts)

```
eventBus → InMemoryEventBus
repository → InMemoryTranscriptionRepository
storage → DiskFileStorage
pdfExtractor → PdfJsExtractorAdapter
ocr → TesseractOcrAdapter('por')
generator → ExcelJsGeneratorAdapter

createTranscription = new CreateTranscriptionUseCase(repo, storage, eventBus)
processTranscription = new ProcessTranscriptionUseCase(repo, storage, pdf, ocr, poolSize)
getTranscription = new GetTranscriptionUseCase(repo)
updateTranscription = new UpdateTranscriptionUseCase(repo)
exportSpreadsheet = new ExportSpreadsheetUseCase(repo, generator)
```

---

## 3. Domain Layer — detalhes

### 3.1 Entity: Transcription (aggregate root)

**Estado**: `PROCESSANDO` → `CONCLUIDO` ou `PROCESSANDO` → `ERRO`

Métodos:

- `create()` → PROCESSANDO, emite `TranscriptionCreated`
- `complete(result)` → CONCLUIDO, emite `TranscriptionCompleted`
- `fail(error)` → ERRO, emite `TranscriptionFailed`
- `updateValue(value)` → só funciona se CONCLUIDO, emite `TranscriptionUpdated`
- `pullEvents()` → retorna e limpa eventos acumulados (event sourcing lite)

### 3.2 Value Objects (imutáveis, factories `from()`)

| VO                    | Validação                                            | Segurança                                 |
| --------------------- | ---------------------------------------------------- | ----------------------------------------- |
| `TranscriptionId`     | Regex UUID canônico                                  | Previne path traversal                    |
| `DocumentType`        | `'cartao-ponto'` \| `'holerite'`                     | Type guard `isDocumentType()`             |
| `TranscriptionStatus` | `'processando'` \| `'concluido'` \| `'erro'`         | Type guard                                |
| `Money`               | Formato BR `'2.389,77'`, aceita `?`                  | Nunca converte para float                 |
| `Punch`               | kind IN/OUT, time HH:MM 24h                          | Preserva `?`                              |
| `DayRecord`           | date_raw + punches[]                                 | `isOddPunches()`, `isDateNonSequential()` |
| `PageCartaoPonto`     | page + days[]                                        |                                           |
| `PageHolerite`        | page, year, month, fields[], bases[]                 | `isEmpty()`                               |
| `PayrollField`        | code, label, reference, value                        | fields ≠ bases                            |
| `PayrollBase`         | label, value                                         |                                           |
| `ExportFormat`        | `'xlsx'` \| `'csv'` \| `'json'`                      |                                           |
| `CellStyle`           | header: bold white on #173772                        |                                           |
| `RowHighlight`        | warning (#FFF3CD) ou error (#F8D7DA + borda #DC3545) | Error > Warning                           |

### 3.3 Extractors (domain services, puros)

- **CartaoPontoExtractor**: regex por linha → data + tempos IN/OUT alternados
- **HoleriteExtractor**: competência (mês/ano) + campos (verbas) + bases (seção separada)
- `extractorFor(tipo)` → seleciona o extrator certo

### 3.4 Services

- **WarningCalculator**: calcula warnings na exibição (não armazena)
  - cartão-ponto: punches ímpares, data não-sequencial
  - holerite: página vazia, mês não-sequencial
- **HighlightDetector**: converte warnings em RowHighlight (amarelo/vermelho)
- **DateValidator**: `parseDateRaw()` → readable/unreadable/impossible

---

## 4. Application Layer — Use Cases

| Use Case               | O que faz                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `CreateTranscription`  | Gera UUID → cria entity → salva repo+storage → publica evento                        |
| `ProcessTranscription` | Lê PDF → extrai texto → OCR fallback para páginas escaneadas → parse → complete/fail |
| `GetTranscription`     | Busca por ID → serializa para DTO                                                    |
| `UpdateTranscription`  | Atualiza value (só se CONCLUIDO)                                                     |
| `ExportSpreadsheet`    | Busca → SpreadsheetBuilder.build() → gera arquivo (xlsx/csv/json)                    |

### 4.1 ProcessTranscriptionUseCase — fluxo detalhado

```
1. repository.findById(id) → se não existe, throw
2. Se status != PROCESSANDO, return (idempotente)
3. storage.read(id) → buffer do PDF
4. pdfExtractor.extractPages(buffer) → string[] por página
5. Para cada página vazia (escaneada):
     pdfExtractor.renderPage(i, buffer) → PNG
     ocrEngine.recognize(png) → texto
   (com limite de concorrência = OCR_WORKER_POOL_SIZE, padrão 2)
6. extractorFor(tipo).extract(textos) → TranscriptionResult
7. transcription.complete(result) → CONCLUIDO
8. repository.save(transcription)
```

### 4.2 Result Parser (PUT validation)

`parseResult(tipo, body.value)` → valida JSON recebido recriando VOs de domínio.
Rejeita money float ('2389.77'), kind inválido, month '13', shape inválido.

---

## 5. Infrastructure Layer — detalhes

### 5.1 Web Server (Fastify)

Stack de plugins (ordem):

1. `multipart` (upload com fileSize limit)
2. `helmet` (security headers)
3. `cors` (origin whitelist)
4. `rate-limit` (100 req/60s por IP)
5. `compress` (gzip/brotli)
6. Error handler customizado
7. Routes

**trustProxy: 'loopback'** — só confia X-Forwarded-* de localhost (Docker nginx).

### 5.2 Rotas da API

| Método | Rota                                      | Status  | O que faz                                              |
| ------ | ----------------------------------------- | ------- | ------------------------------------------------------ |
| GET    | `/healthz`                                | 200     | Health check                                           |
| POST   | `/api/transcricoes`                       | 202     | Upload PDF → cria transcrição → processa em background |
| GET    | `/api/transcricoes/:id`                   | 200/404 | Consulta status/resultado                              |
| PUT    | `/api/transcricoes/:id`                   | 200     | Atualiza value (correções manuais)                     |
| GET    | `/api/transcricoes/:id/planilha?formato=` | 200     | Download xlsx/csv/json                                 |

### 5.3 POST /api/transcricoes — lifecycle completo

```
1. ProcessingQueue.acquire(ip) → 429 se exceder limite
2. Parse multipart: arquivo (Buffer) + tipo (string)
3. Validações:
   - arquivo e tipo presentes
   - isDocumentType(tipo)
   - isPdfMagicBytes(arquivo) → 5 primeiros bytes = "%PDF-"
   - isUploadTooLarge(arquivo, maxBytes)
4. createTranscription.execute() → UUID, entity, repo, storage, eventBus
5. setImmediate → processTranscription.execute(id) (background)
6. Responde 202 { id: uuid }
7. ProcessingQueue.release(ip)
```

### 5.4 Middlewares de segurança

| Camada            | Mecanismo                                                       |
| ----------------- | --------------------------------------------------------------- |
| Upload size       | 3 camadas: Fastify bodyLimit, multipart fileSize, chunk counter |
| Magic bytes       | Primeiros 5 bytes = `%PDF-`                                     |
| UUID validation   | Regex canônico em TranscriptionId.from()                        |
| Rate limit        | 100 req/60s por IP (configurável)                               |
| Per-IP queue      | Max 3 uploads simultâneos por IP (429)                          |
| trustProxy        | 'loopback' — só confia proxies locais                           |
| PII redaction     | Logger scrub: CPF, matrícula, email, auth headers               |
| Sanitized storage | Arquivos como `<uuid>.pdf`, nunca nome original                 |
| CORS              | Origin whitelist configurável                                   |
| Helmet            | Security headers padrão                                         |

### 5.5 Retention

- Timer em `bootstrap.ts`: `setInterval(min(retentionMs, 60s))`
- `repository.deleteOlderThan(retentionMs)` + limpeza de storage
- Try-catch no callback (não derruba o processo)
- Graceful shutdown: SIGINT/SIGTERM → close app → close OCR worker

---

## 6. Frontend — detalhes

### 6.1 Fluxo do usuário

```
1. Upload → seleciona PDF + tipo → POST /api/transcricoes → recebe { id }
2. Polling → useTranscricao(id) com react-query: GET /:id a cada 2s
   Para automaticamente quando status é terminal (concluido/erro)
3. Revisão → ReviewTable editável + PdfViewer lado a lado
   Edição com debounce 500ms → PUT /:id → invalida cache → "Correções salvas"
4. Download → 3 botões (xlsx/csv/json) → <a href> direto para API
```

### 6.2 Componentes

| Componente       | Responsabilidade                                             |
| ---------------- | ------------------------------------------------------------ |
| `Upload`         | Formulário: radio tipo + file input + botão enviar           |
| `ReviewTable`    | Tabela editável: colunas dinâmicas, warnings inline          |
| `PdfViewer`      | Lazy-loaded react-pdf, navegação por página, revokeObjectURL |
| `DownloadButton` | 3 links: xlsx, csv, json                                     |
| `WarningBadge`   | Badge amarelo/vermelho com tooltip                           |

### 6.3 Hooks

| Hook             | O que faz                                                     |
| ---------------- | ------------------------------------------------------------- |
| `useTranscricao` | react-query polling (2s), auto-para em status terminal, cache |
| `useUpload`      | Estado do form, POST FormData, callback onSuccess(id, file)   |

### 6.4 Vite Config

- Dev proxy: `/api` e `/healthz` → `http://localhost:3001`
- Build `manualChunks`: react, pdf, react-query (cache otimizado)

---

## 7. Testes — 179 testes, 24 arquivos

### 7.1 Estrutura

```
tests/
  unit/
    domain/          (12 arquivos, ~100 testes)
      transcription/   entity, VOs, extractors, warning-calculator
      spreadsheet/     builder, highlight-detector, row-highlight, export-format
      shared/          TranscriptionId, DocumentType, TranscriptionStatus, CellStyle
    application/     (6 arquivos, ~39 testes)
      create, process, get, update, export, result-parser
  integration/       (3 arquivos, ~21 testes)
    api.test.ts        (12 testes: contrato HTTP completo)
    upload-security    (6 testes: limites, magic bytes, sanitização, 429)
    pipeline.test.ts   (3 testes: E2E com PDFs reais)
```

### 7.2 Cobertura

- Domain: threshold 90% (branches/functions/lines)
- Application: threshold 80%
- Frontend: não medido (gap conhecido)

### 7.3 Testes notáveis

- **Path traversal**: `TranscriptionId.from('../../etc/passwd')` → rejeita
- **Financial precision**: money '2389.77' (float) → rejeita; só aceita '2.389,77'
- **Uncertainty**: `?` propagado de OCR → VOs → spreadsheet highlights
- **State machine**: ERRO→CONCLUIDO, CONCLUIDO→ERRO → rejeita
- **429**: 2 uploads simultâneos do mesmo IP → um 202, outro 429
- **Pipeline E2E**: PDF real → extração → revisão → download em 3 formatos

---

## 8. Release v1.1.0 — como eu guiei as correções

### 8.1 Processo de auditoria

Realizei uma auditoria sistemática do codebase, analisando cada camada com
foco em **segurança**, **bugs** e **performance**. O resultado foi um relatório
com 18 findings categorizados por severidade.

### 8.2 Findings e correções implementadas

#### SEGURANÇA (3 findings)

| #   | Finding                                                                                                                                               | Severidade | Correção                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| 1   | `TranscriptionId` aceitava qualquer string não-vazia — path traversal via `../../etc/passwd` em `uploads/<id>.pdf` e injeção em `Content-Disposition` | MEDIUM     | Regex UUID canônico em `TranscriptionId.from()`       |
| 2   | `trustProxy: true` — qualquer cliente podia spoofar `X-Forwarded-For` para contornar rate limit e limite por IP                                       | LOW        | Alterado para `'loopback'` (só confia proxies locais) |
| 3   | Vulnerabilidade em `uuid` via ExcelJS (`npm audit` moderate)                                                                                          | LOW        | Override `"uuid": "11.1.1"` no package.json raiz      |

#### BUGS (5 findings)

| #   | Finding                                                                                                        | Severidade | Correção                                                        |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| 4   | `ProcessingQueue` definida mas **nunca conectada** ao roteador — uploads simultâneos por IP não eram limitados | MEDIUM     | Wire em `server.ts` + wrap do POST em `uploadQueue.run()` + 429 |
| 5   | `URL.createObjectURL()` no PdfViewer nunca era revogada — memory leak                                          | MEDIUM     | `useEffect` cleanup com `URL.revokeObjectURL()`                 |
| 6   | Debounce de salvamento (500ms) no App não era limpo no unmount — PUT em estado morto                           | LOW        | `useEffect` cleanup com `clearTimeout()`                        |
| 7   | Após salvar correções via PUT, a tabela não refletia o valor salvo — cache stale do react-query                | LOW        | `queryClient.invalidateQueries()` após PUT                      |
| 8   | Retention cleanup sem try-catch — exceção no `deleteOlderThan` podia derrubar o processo                       | LOW        | Try-catch no callback do setInterval                            |

#### PERFORMANCE (10 findings)

| #   | Finding                                                                                                            | Severidade | Correção                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------- |
| 9   | ReviewTable: `structuredClone()` da árvore inteira a cada edição de célula — bloqueava main thread em docs grandes | HIGH       | Immutable update por path com spread operators                          |
| 10  | Polling com `setInterval` + `useState` manual — sem cache, sem deduplicação, polling continuava em status terminal | MEDIUM     | Migração para `@tanstack/react-query` (cache, auto-stop, cleanup)       |
| 11  | `document.querySelector('input[type="file"]')` no App — anti-pattern React                                         | MEDIUM     | Arquivo flui via callback `onUploaded(id, arquivo)`                     |
| 12  | `SpreadsheetBuilder`: `.includes()` e `.find()` em arrays → O(n²)                                                  | MEDIUM     | `Set` para dedup de labels, `Map` para lookups de warnings              |
| 13  | Extração de páginas PDF sequencial                                                                                 | MEDIUM     | `Promise.all()` paralelo                                                |
| 14  | OCR sequencial — Tesseract é intensivo em memória                                                                  | MEDIUM     | `runWithConcurrency()` com limite configurável (`OCR_WORKER_POOL_SIZE`) |
| 15  | Upload: chunk size com `.reduce()` → O(n²)                                                                         | LOW        | Contador acumulado `total += chunk.length`                              |
| 16  | Vite sem `manualChunks` — vendor inteiro num bundle                                                                | LOW        | Separação: react, pdf, react-query                                      |
| 17  | JSON export com pretty-print (2 spaces)                                                                            | LOW        | `JSON.stringify(objects)` sem indentação                                |
| 18  | Dependências não usadas: `@tanstack/react-table`, `lucide-react`                                                   | LOW        | Removidas do frontend                                                   |

### 8.3 Decisões técnicas durante a implementação

1. **UUID regex genérico vs v4 estrito**: Optei pelo formato canônico
   (`[0-9a-f]{8}-...`) em vez do v4 estrito. Ambos bloqueiam path traversal;
   o genérico é mais flexível para IDs gerados por outras versões de UUID.

2. **ProcessingQueue `run<T>` genérico**: Refatorei para retornar o valor da
   task, permitindo que o POST retorne o resultado do `createTranscription`
   enquanto mantém o slot da fila.

3. **`runWithConcurrency` helper**: Implementei como função local no use-case
   em vez de utilitário genérico — mantém a lógica de concorrência coesa com
   o processamento de OCR.

4. **EventBus unsubscribe**: O `subscribe()` agora retorna uma closure de
   cleanup, prevenindo acúmulo de handlers ao longo da vida do processo.

5. **Cache invalidation após PUT**: Em vez de optimistic update (complexo),
   invalidei a query inteira do react-query. Mais simples, garante consistência.

### 8.4 Verificações antes do commit

```bash
npm run lint         # ✅ ESLint passou
npm run typecheck    # ✅ TypeScript passou
npm test             # ✅ 179/179 testes passaram
```

### 8.5 Commit resultante

```
fix: harden transcription ids and upload queue, fix leaks, speed up processing
```

33 arquivos, +510/−291 linhas, mensagem Conventional Commits estruturada em
Security / Fixed / Performance / Docs.

---

## 9. Decisões de design importantes (para PROCESSO.md)

### 9.1 Decisões com mais de uma resposta razoável

1. **DDD + Hexagonal vs arquitetura mais simples**: DDD é overkill para um
   projeto deste tamanho, mas o desafio pede explicitamente e demonstra
   competência arquitetural. A separação domain/application/infrastructure
   permite testar cada camada isoladamente.

2. **InMemoryRepository vs banco real**: Para o escopo do desafio (demonstração),
   repositório em memória é suficiente e elimina complexidade de setup. Em
   produção, bastaria implementar o port com SQLite/Postgres.

3. **OCR fallback vs rejeitar PDFs sem texto**: Alguns PDFs são escaneados
   (imagem pura). Em vez de rejeitar, implementei fallback para Tesseract OCR.
   Custo: complexidade e tempo de processamento. Ganho: mais documentos
   processados com sucesso.

### 9.2 O que quebra primeiro em produção

1. **Memória**: O repositório em memória cresce indefinidamente. Com muitos
   uploads, o processo vai OOM. Solução: banco persistente (SQLite/Postgres).

2. **OCR timeout**: PDFs grandes com muitas páginas escaneadas podem exceder
   o timeout de 60s. O `processingTimeoutMs` precisa ser ajustado por
   tamanho do documento.

3. **Concorrência**: O InMemoryEventBus e ProcessingQueue são single-process.
   Com múltiplas instâncias (Docker replicas), a fila por IP não é compartilhada.

### 9.3 Onde não confio no que foi entregue

1. **Extração de texto**: Os regexes dos extractors funcionam para os PDFs de
   exemplo, mas documentos com layouts diferentes podem falhar silenciosamente
   (extração parcial sem erro).

2. **WarningCalculator**: A semântica de "não quebram a cadeia" (datas
   ilegíveis são ignoradas na comparação) é interpretação minha do spec.
   Pode não ser a intenção do avaliador.

3. **Frontend sem testes**: A lógica de warning no frontend (`utils/warnings.ts`)
   replica parcialmente a do domain mas com implementação separada e sem
   testes. Divergência silenciosa é possível.

---

## 10. Entregáveis do desafio

- [x] Repositório GitHub: `https://github.com/hatanaca/quick-filler-test`
- [ ] URL deployada
- [x] SOLUCAO.md (política de retenção, escolha do OCR)
- [x] PROCESSO.md (3 perguntas obrigatórias)
- [x] Spreadsheets de exemplo (2 PDFs — cartao-ponto-1, holerite-1 — × xlsx/csv/json)
- [x] CHANGELOG.md com versões
- [x] SECURITY.md bilingue
- [x] CI pipeline (lint → typecheck → test → audit → docker build)

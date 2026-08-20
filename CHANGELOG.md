# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-08-19

### Added

- **Segurança**: sistema de autenticação JWT completo — login, refresh (cookie
  httpOnly), logout e endpoint `GET /api/auth/me`. Senhas hasheadas com
  `scrypt` + salt aleatório; comparação timing-safe contra timing attacks.
  Todas as rotas de transcrição agora requerem `Authorization: Bearer <token>`.
- **OCR**: pré-processamento de imagem antes do OCR — grayscale, binarização
  adaptativa de Sauvola, correção de deskew por projeção, detecção automática
  de tinta vermelha (carimbos).
- **Domínio**: novos utilitários compartilhados — `date-utils.ts`
  (`parseDateRaw`, `daysBetween`), `text-utils.ts`, `parse-utils.ts`
  (funções de parsing compartilhadas), `competence-builder.ts` (builder
  para competência de holerites).
- **Domínio**: tipo discriminated union com campo `kind` para
  `TranscriptionResult` — permite distinguir `cartao-ponto` de `holerite`
  no tipo de resultado.

### Fixed

- **Frontend**: `PdfViewer` — caminho dos CSS do react-pdf corrigido; import
  `?url` para worker em produção.
- **Domínio**: `HEADER_KEYWORDS_RE` filtrava dados legítimos do cartão de
  ponto — removido.
- **Infra**: nginx — `limit_req_zone` movido para nível http (fora do server
  block), correto para múltiplos server blocks.
- **Infra**: networking Docker — backend e frontend fazem bind em `0.0.0.0`
  para comunicação entre containers.
- **Infra**: leitura e transcrição de documentos em produção corrigida
  (edge cases na extração e edição).
- **Deploy**: credenciais e IPs hardcoded removidos de scripts de deploy.

### Changed

- **OCR**: `TesseractOcrAdapter` reescrito com acesso à hierarquia de
  símbolos do Tesseract (acesso a alternativas por caractere).

### Removed

- **CI**: workflow de deploy do GitHub Actions (`deploy.yml`) removido —
  deploy agora é manual via SSH/scripts.

## [1.3.0] - 2026-08-17

### Fixed

- **Domínio**: `CartaoPontoExtractor` — datas de cabeçalho/rodapé que aparecem
  em múltiplas páginas sem batidas (ex.: data de emissão do relatório) agora
  são filtradas automaticamente. Antes, `time-card-03.json` tinha entradas
  fantasmas como "09/03/2026" e "16/12/2019" repetidas em cada página.
- **Domínio**: `HoleriteExtractor` — entradas duplicadas do mesmo mês/página
  na Ficha Financeira agora são mescladas quando seus campos se sobrepõem.
  Antes, `payroll-01.json` tinha linhas duplicadas para meses com seções de
  continuação (ex.: mês 10 e 12 de 2017).

### Changed

- **OCR**: `PDF_RENDER_SCALE` padrão alterado de 4 para 5 (~288 DPI → ~360 DPI)
  — mais próximo do recomendado de 300 DPI para Tesseract.
- **OCR**: `OCR_CONFIDENCE_THRESHOLD` padrão alterado de 40 para 60 — mais
  restritivo, reduz falsos positivos em documentos escaneados.

## [1.2.0] - 2026-08-16

### Fixed

- **Domínio**: `HoleriteExtractor` — `MONEY_RE` agora aceita `?` de incerteza
  (ex.: `2.38?,77` não corrompe mais label/value) e valores com 4+ dígitos
  sem separador de milhar (`1234,56` era cortado para `234,56`)
- **Domínio**: `WarningCalculator` — datas impossíveis (38/07, 31/02, 29/02
  não-bissexto) não viram âncora da cadeia de sequência; `date-utils` valida
  dias-por-mês com ano bissexto
- **Domínio**: `Money` aceita valor totalmente incerto com separador (`??,??`)
  e rejeita string sem dígitos nem `?` (`"..,,"`)
- **Domínio**: erro com mensagem vazia não deixa transcrição presa em
  `PROCESSANDO`; `PROCESSING_TIMEOUT_MS` agora é aplicado (timeout no
  processamento libera o slot da fila)
- **Domínio**: `EventBus` — um handler que lança não interrompe os demais;
  mapper serializa pelo tipo real (cartão vazio não vira holerite)
- **Infra**: retenção agora apaga os PDFs do disco (`deleteOlderThan` devolve
  ids e o bootstrap chama `storage.delete`)
- **Infra**: processamento roda dentro do slot per-IP da fila (antes o limite
  era contornado por N uploads sequenciais → N jobs concorrentes, DoS)
- **Infra**: `TesseractOcrAdapter.getWorker` memoiza a promise — sem race que
  vazava workers; `pdf.js` chama `page.cleanup()` e `task.destroy()` em
  `finally` (cobre PDF corrompido)
- **Infra**: CSV neutraliza células iniciadas com `= + - @`/tab/CR (fórmula
  injection no Excel); upload com dois campos `arquivo` rejeita com 400
- **Infra**: `create` salva o arquivo antes do registro (rollback) — sem
  registro órfão; multipart drena todas as parts; PII redigida também em
  headers e url; `bodyLimit` com folga de 1MB para overhead do multipart
- **Infra**: `loadConfig(env)` respeitava o parâmetro `env`? — não; agora lê
  do objeto recebido; valores zerados/negativos (retenção, timeout, pool,
  rate limit) caem no fallback — impossível `setInterval(0)`
- **Infra**: `TRUST_PROXY` configurável (default `loopback`; em Docker atrás
  do nginx, `loopback,172.16.0.0/12`) — rate limit/fila veem o IP real do
  cliente; `RATE_LIMIT_MAX` padrão 300/min (o polling de 2s consumia ~90/min
  com 3 transcrições simultâneas)
- **Frontend**: `ReviewTable` mantém draft local — edições não são perdidas
  entre PUTs (antes o payload era reconstruído do cache a cada keystroke);
  erro de PUT 400 agora aparece na UI
- **Frontend**: dia com batidas ímpares aceita adicionar a batida faltante;
  horário `8:25` é normalizado para `08:25` antes do PUT
- **Frontend**: PUTs serializados com `saveChain`; `setQueryData` em vez de
  `invalidate`; `refetchOnWindowFocus` desligado; indicador "salvo" não vaza
  entre documentos; polling com retry e cancelamento no status terminal
- **Frontend**: upload usa `createTranscription` (respeita `VITE_API_URL`);
  coluna "Pág." do holerite é read-only (não cria campo fantasma); blob URL
  sem vazamento; data fora do formato não vira âncora de avisos
- **Makefile**: alvos `test:unit:`/`test:integration:`/`format:check:` eram
  parseados como static pattern rules e derrubavam o Makefile inteiro —
  renomeados para `test-unit`/`test-integration`/`format-check`
- **Deps**: removidas `zod` (application/infrastructure), `nanoid`,
  `csv-stringify`, `pdf-parse`; `tsx` declarado na raiz

## [1.1.0] - 2026-08-12

### Fixed

- **Segurança**: `TranscriptionId` agora valida formato UUID — bloqueia path
  traversal via id em `uploads/<id>.pdf` e injeção em `Content-Disposition`
- **Segurança**: `trustProxy` restrito a `loopback` (antes `true`) — impede
  spoofing de `X-Forwarded-For` para contornar rate limit / limite por IP
- **Bug**: `ProcessingQueue` (limite de uploads simultâneos por IP) era
  definida mas nunca conectada ao roteador — agora retorna 429 ao exceder
  `UPLOAD_MAX_CONCURRENT_PER_IP`
- **Bug**: `URL.createObjectURL` no PDF viewer nunca era revogada (memory
  leak) — cleanup no unmount e na troca de arquivo
- **Bug**: debounce de salvamento no frontend não era limpo no unmount —
  podia disparar PUT com estado morto
- **Bug**: cleanup de retenção sem try-catch — exceção podia derrubar o
  processo
- **Bug**: após salvar correções, a tabela não refletia o valor salvo —
  cache stale; agora a query é invalidada após o PUT

### Performance

- `ReviewTable`: edição de célula usa immutable update por path em vez de
  `structuredClone` da árvore inteira (bloqueava a main thread em docs grandes)
- `useTranscricao`: polling migrado de `setInterval` para `@tanstack/react-query`
  (cache, deduplicação, cleanup automático, polling desligado em status terminal)
- `App.tsx`: removido `document.querySelector` — arquivo agora flui via callback
  do componente `Upload`
- `SpreadsheetBuilder`: deduplicação de labels com `Set` e lookups de warnings
  com `Map` (O(n²) → O(n))
- Extração de páginas do PDF e OCR paralelizados com limite de concorrência
  (`OCR_WORKER_POOL_SIZE` agora é respeitado)
- Upload: contagem de chunks acumulada em variável (era O(n²))
- Vite: `manualChunks` separa react/react-dom, pdf e react-query
- JSON export sem pretty-print (menos bytes no download)
- Removidas dependências não utilizadas do frontend: `@tanstack/react-table`,
  `lucide-react`

### Security

- `npm audit` limpo: override de `uuid` → 11.1.1 (via ExcelJS)

## [1.0.0] - 2026-08-11

### Added

- Initial project structure (DDD monorepo with npm workspaces)
- Domain layer: `Transcription` entity, value objects (Money, Punch, DayRecord, PageHolerite, RowHighlight), warning calculator, highlight detector, spreadsheet builder, ports
- Application layer: create/get/update/process/export use cases, event bus, result parser
- Infrastructure layer: Fastify server, security middleware (helmet, CORS, rate limit), PDF extraction (pdfjs-dist), OCR (Tesseract.js), spreadsheet exporters (xlsx/csv/json), in-memory repository, disk storage
- Frontend: upload with progress, editable review table with warnings, PDF viewer, downloads
- Docker: multi-stage Dockerfile, docker-compose, nginx reverse proxy
- GitHub: CI workflow, issue/PR templates, SECURITY.md, dependabot, CODEOWNERS
- Tests: 177 unit/integration/E2E tests (TDD)
- Documentation: bilingual PT-BR/EN (README, CONTRIBUTING, docs/)
- Scripts: synthetic PDF generation, deliverable spreadsheet generation

# Changelog

All notable changes to this project will be documented in this file.

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

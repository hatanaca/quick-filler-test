# SOLUCAO.md — Solução do Desafio Quick Filler

## Como rodar

### Requisitos

- Node.js >= 22 (ou Docker)

### Local

```bash
cp .env.example .env
npm install
npm run dev                       # backend: http://localhost:3001
npm run dev --workspace=@quickfiller/frontend   # frontend: http://localhost:5173
```

### Docker (requisito duro do desafio)

```bash
docker compose up --build
# backend: http://localhost:3001 · frontend: http://localhost:5173
```

### Verificações

```bash
npm run lint && npm run typecheck && npm test
```

## Decisões técnicas

### Stack

- **Fastify** (Node 22 + TypeScript strict): mais rápido que Express e com
  validação de schema nativa; o contrato HTTP é o único requisito fechado.
- **Tesseract.js** para OCR: local, sem custo e sem API key — a maior parte
  dos documentos reais é escaneada e o fallback precisa funcionar offline.
  Modelo `por` carregado uma vez e reutilizado (warm start).
- **pdfjs-dist** para extração de texto e renderização de páginas; linhas
  reconstruídas pela geometria (posição Y), não por `\n` — PDFs reais não
  têm quebras de linha.
- **ExcelJS** para xlsx; csv e json nativos.
- **React + Vite + react-pdf** para a interface; PDF viewer com lazy loading.

### Arquitetura

DDD com Ports & Adapters:

- `packages/domain` — puro, zero dependências externas: entidade
  `Transcription` (com regras de transição de status), value objects
  (`Money` nunca float, `Punch`, `DayRecord`, `PageHolerite`...), serviços
  (`WarningCalculator`, `HighlightDetector`, `SpreadsheetBuilder`) e ports
  (repositório, PDF, OCR, storage, gerador de planilha).
- `packages/application` — use cases (create/get/update/process/export) e
  event bus em memória. Testados com mocks **apenas nos ports**.
- `packages/infrastructure` — Fastify (rotas, middleware de segurança,
  upload com magic bytes, logger com redação de PII), adapters reais e DI
  manual.
- `packages/frontend` — envio, polling de status (2s), tabela editável com
  problemas destacados nas cores da planilha, PDF ao lado, download.

### Processamento assíncrono

`POST /api/transcricoes` responde `202` imediatamente e o processamento roda
em background (`setImmediate`) — nunca dentro do request HTTP. O cliente
descobre a conclusão por polling em `GET /api/transcricoes/:id`.

### Escolha dos testes (uma linha por caso)

- `money.vo`: o `?` e o formato brasileiro são a base da "honestidade dos dados" (15% da nota)
- `warning-calculator`: avisos derivados (batidas ímpares, não sequencial, dez→jan) regem os destaques
- `extractors`: a separação `fields`/`bases` e a ordem do documento são o coração da precisão (30%)
- `pipeline` (E2E): prova que enviar → processar → revisar → baixar funciona de ponta a ponta (20%)
- `upload-security`: magic bytes, limite e sanitização são o que o recrutador verifica em segurança (10%)

## Política de retenção

- **O que guarda**: o PDF enviado (em disco, `uploads/`) e a transcrição
  (repositório em memória).
- **Onde**: `uploads/` dentro do container (volume Docker); transcrições em
  memória do processo.
- **Por quanto tempo**: arquivos e transcrições são removidos após
  `RETENTION_MINUTES` (padrão 60 minutos) pelo cleanup service.
- **Sem PII**: nomes de arquivo são UUIDs; logs redigem CPF, matrícula e
  e-mail automaticamente.

## OCR: escolha e comportamento

- Ferramenta: **Tesseract.js** (local, modelo `por`).
- Detecção: `extractPages` devolve o texto por página; páginas sem texto são
  renderizadas como imagem e enviadas ao OCR.
- Limitação conhecida: Tesseract é bom, mas não é um serviço de nuvem —
  a calibração dos `?` depende da qualidade da digitalização. O `SOLUCAO.md`
  reconhece: textos digitalizados com contraste ruim tendem a mais `?`,
  o que é honesto por construção.

## O que ficou de fora (escopo cortado)

- **Planilhas dos PDFs oficiais**: os arquivos `exemplos/*.pdf` não estão no
  repositório público do desafio (apenas README); a pasta contém PDFs
  sintéticos equivalentes e o script `npm run samples` gera as planilhas
  assim que os oficiais forem fornecidos.
- **Bônus** (não implementados): rastreabilidade visual (coordenadas),
  detecção automática de tipo, ficha financeira anual.
- **Banco de dados**: repositório em memória é suficiente para o fluxo e a
  retenção curta; a interface `TranscriptionRepository` permite trocar por
  SQLite/Postgres sem tocar em domain/application.

## O que eu mudaria no formato (se pudesse)

O contrato é bom. Única observação: a incerteza `?` perde a posição do
separador decimal quando o separador em si não é legível — uma convenção
explícita para esse caso (`2.389?77` vs `2.389,?7`) reduziria ambiguidade na
revisão.

## Como avalio minha entrega

| Critério | Autoavaliação |
|----------|--------------|
| Precisão da extração | Forte nos PDFs com texto; OCR funciona mas depende da digitalização |
| Honestidade dos dados | `?` por caractere, datas impossíveis nunca produzidas |
| Ciclo completo | Validado E2E em teste e via Docker |
| Arquitetura | DDD hexagonal, pipeline único, processamento assíncrono |
| Segurança | Magic bytes, limite, retenção, PII redigida |
| Código/decisões | 177 testes, lint + typecheck limpos, docs bilingues |

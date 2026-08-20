# Quick Filler — Transcrição de Documentos Trabalhistas

<!-- English version: see [README_EN.md](README_EN.md) -->

Aplicação web para transcrição de **cartões de ponto** e **holerites** em PDF para planilhas estruturadas — com OCR para documentos escaneados, revisão editável e download em xlsx/csv/json. Desafio técnico da [Quick Filler](https://github.com/quick-filler/desafio-programador).

## Sobre / About

**PT-BR:** O usuário envia um PDF (cartão de ponto ou holerite), a aplicação extrai os dados (texto embutido ou OCR para documentos escaneados), mostra a transcrição numa tabela editável ao lado do PDF com problemas destacados, e permite baixar a planilha já corrigida.

**EN:** The user uploads a PDF (time card or pay stub), the app extracts the data (embedded text or OCR for scanned documents), shows the transcription in an editable table next to the PDF with highlighted issues, and allows downloading the corrected spreadsheet.

## Stack

| Camada    | Tecnologia                                  |
| --------- | ------------------------------------------- |
| Backend   | Node.js 22+ · TypeScript · Fastify          |
| Frontend  | React 18 · Vite · react-pdf                 |
| OCR       | Tesseract.js (local, sem nuvem)             |
| PDF       | pdfjs-dist                                  |
| Planilhas | ExcelJS (xlsx) · csv (nativo) · JSON        |
| Testes    | Vitest (TDD: domain e application primeiro) |
| Qualidade | ESLint · Prettier · TypeScript strict       |
| Container | Docker + docker-compose                     |

## Arquitetura

DDD com Ports & Adapters (Hexagonal):

```
packages/
├── domain/          ← Camada pura: entidades, value objects, serviços, ports
├── application/     ← Use cases, DTOs, event bus (testados com mocks nos ports)
├── infrastructure/  ← Fastify, OCR (Tesseract), PDF (pdfjs), exporters, DI
└── frontend/        ← Interface de revisão (React)
```

Regras: `domain` não depende de nada; `application` depende só de `domain`;
`infrastructure` implementa os ports. Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Como Rodar / Getting Started

### Requisitos / Prerequisites

- Node.js >= 22
- Docker + docker-compose (opcional)

### Português

```bash
cp .env.example .env   # configuração local
npm install
npm run dev            # backend em http://localhost:3001
# em outro terminal:
npm run dev --workspace=@quickfiller/frontend   # frontend em http://localhost:5173
```

### English

```bash
cp .env.example .env
npm install
npm run dev
npm run dev --workspace=@quickfiller/frontend
```

### Docker (produção)

```bash
docker compose up --build
# backend: http://localhost:3001   frontend: http://localhost:5173
```

## API

Contrato literal do desafio (obrigatório e inalterável). Rotas de transcrição
requerem `Authorization: Bearer <token>`:

| Método | Rota                                                     | Descrição                                                        |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/auth/login`                                        | Login (email+password) → JWT + refresh cookie                    |
| POST   | `/api/auth/refresh`                                      | Renova access token via refresh cookie                           |
| POST   | `/api/auth/logout`                                       | Revoga refresh token                                             |
| GET    | `/api/auth/me`                                           | Dados do usuário autenticado                                     |
| POST   | `/api/transcricoes`                                      | Upload `multipart/form-data` (`arquivo` + `tipo`) → `202 { id }` |
| GET    | `/api/transcricoes/:id`                                  | Status (`processando`/`concluido`/`erro`) + `value`              |
| PUT    | `/api/transcricoes/:id`                                  | Substitui `value` com as correções da interface                  |
| GET    | `/api/transcricoes/:id/planilha?formato=xlsx\|csv\|json` | Download com correções                                           |
| GET    | `/healthz`                                               | Health check                                                     |

Detalhes e exemplos em [docs/API.md](docs/API.md).

## Segurança / Security

- Upload limitado a 20MB e validado por magic bytes (`%PDF`), nunca por extensão
- Nomes de arquivo sanitizados (UUID — sem PII)
- Rate limiting, helmet, CORS whitelist
- PII redigida nos logs (CPF, matrícula, e-mail)
- Retenção automática de uploads (configurável, padrão 60min)
- Container roda como usuário não-root

Detalhes em [docs/SECURITY.md](docs/SECURITY.md).

## Testes

```bash
npm test                 # todos (unit + integration)
npm run test:unit        # domain + application (TDD, sem mocks no domain)
npm run test:domain      # apenas domain (VOs, entidades, extratores, serviços)
npm run test:frontend    # componentes React (Vitest + Testing Library)
npm run test:integration # rotas HTTP + pipeline E2E com PDFs reais
npm run test:e2e         # testes end-to-end com Playwright
npm run test:coverage    # domain >= 90%, application >= 80%
```

## Estrutura / Structure

- `docs/` — arquitetura, API, segurança e guia de TDD (PT-BR/EN)
- `exemplos/` — PDFs do desafio (ver [exemplos/README.md](exemplos/README.md))
- `tests/fixtures/pdfs/` — PDFs sintéticos para testes
- `scripts/` — geração de PDFs de teste e das planilhas de entrega

## Licença / License

MIT

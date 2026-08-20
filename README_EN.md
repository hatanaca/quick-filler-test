# Quick Filler — Labor Document Transcription

Web application for transcribing **time cards** and **pay stubs** from PDF to structured spreadsheets — with OCR for scanned documents, editable review, and xlsx/csv/json downloads. Technical challenge from [Quick Filler](https://github.com/quick-filler/desafio-programador).

## About

The user uploads a PDF (time card or pay stub), the app extracts the data (embedded text, or OCR for scanned documents), shows the transcription in an editable table next to the PDF with highlighted issues, and allows downloading the corrected spreadsheet.

## Tech Stack

| Layer        | Technology                                 |
| ------------ | ------------------------------------------ |
| Backend      | Node.js 22+ · TypeScript · Fastify         |
| Frontend     | React 18 · Vite · react-pdf                |
| OCR          | Tesseract.js (local, no cloud)             |
| PDF          | pdfjs-dist                                 |
| Spreadsheets | ExcelJS (xlsx) · native CSV · JSON         |
| Tests        | Vitest (TDD: domain and application first) |
| Quality      | ESLint · Prettier · TypeScript strict      |
| Container    | Docker + docker-compose                    |

## Architecture

DDD with Ports & Adapters (Hexagonal):

```
packages/
├── domain/          ← Pure layer: entities, value objects, services, ports
├── application/     ← Use cases, DTOs, event bus (tested with port mocks)
├── infrastructure/  ← Fastify, OCR (Tesseract), PDF (pdfjs), exporters, DI
└── frontend/        ← Review interface (React)
```

Rules: `domain` depends on nothing; `application` only depends on `domain`;
`infrastructure` implements the ports. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting Started

### Prerequisites

- Node.js >= 22
- Docker + docker-compose (optional)

```bash
cp .env.example .env
npm install
npm run dev                         # backend on http://localhost:3001
npm run dev --workspace=@quickfiller/frontend   # frontend on http://localhost:5173
```

### Docker (production)

```bash
docker compose up --build
# backend: http://localhost:3001   frontend: http://localhost:5173
```

## API

Literal challenge contract (mandatory and unchangeable). Transcription routes
require `Authorization: Bearer <token>`:

| Method | Route                                                    | Description                                                      |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/auth/login`                                        | Login (email+password) → JWT + refresh cookie                    |
| POST   | `/api/auth/refresh`                                      | Refresh access token via cookie                                  |
| POST   | `/api/auth/logout`                                       | Revoke refresh token                                             |
| GET    | `/api/auth/me`                                           | Authenticated user info                                          |
| POST   | `/api/transcricoes`                                      | Upload `multipart/form-data` (`arquivo` + `tipo`) → `202 { id }` |
| GET    | `/api/transcricoes/:id`                                  | Status (`processando`/`concluido`/`erro`) + `value`              |
| PUT    | `/api/transcricoes/:id`                                  | Replaces `value` with UI corrections                             |
| GET    | `/api/transcricoes/:id/planilha?formato=xlsx\|csv\|json` | Download with corrections                                        |
| GET    | `/healthz`                                               | Health check                                                     |

Details and examples in [docs/API.md](docs/API.md).

## Security

- Upload limited to 20MB and validated by magic bytes (`%PDF`), never by extension
- Sanitized file names (UUID — no PII)
- Rate limiting, helmet, CORS whitelist
- PII redacted in logs (CPF, registration, email)
- Automatic upload retention (configurable, default 60min)
- Container runs as non-root user

Details in [docs/SECURITY.md](docs/SECURITY.md).

## Tests

```bash
npm test                 # all (unit + integration)
npm run test:unit        # domain + application (TDD, no mocks in domain)
npm run test:domain      # domain only (VOs, entities, extractors, services)
npm run test:frontend    # React components (Vitest + Testing Library)
npm run test:integration # HTTP routes + E2E pipeline with real PDFs
npm run test:e2e         # end-to-end with Playwright
npm run test:coverage    # domain >= 90%, application >= 80%
```

## Structure

- `docs/` — architecture, API, security, and TDD guide (PT-BR/EN)
- `exemplos/` — challenge PDFs (see [exemplos/README.md](exemplos/README.md))
- `tests/fixtures/pdfs/` — synthetic test PDFs
- `scripts/` — test PDF generation and deliverable spreadsheet generation

## License

MIT

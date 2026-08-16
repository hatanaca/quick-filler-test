# 7. Referência

> [← Voltar ao índice](GUIA.md)

## 7.1 Comandos Úteis

```bash
# Desenvolvimento
npm run dev                          # Backend (porta 3001)
npm run dev --workspace=@quickfiller/frontend  # Frontend (porta 5173)

# Testes
npm test                             # Todos
npm run test:unit                    # Domain + Application
npm run test:integration             # HTTP + Pipeline
npm run test:coverage                # Com cobertura

# Qualidade
npm run typecheck                    # TypeScript strict
npm run lint                         # ESLint
npm run format                       # Prettier

# Build
npm run build                        # Todos os pacotes

# Docker
docker compose up --build            # Produção
```

---

## 7.2 Fluxo de Dados Completo

```
┌──────────┐     POST      ┌──────────┐    save     ┌──────────┐
│ Frontend │ ─────────────► │ Fastify  │ ──────────► │ InMemory │
│ (React)  │                │ Routes   │             │ Repository│
└──────────┘                └──────────┘             └──────────┘
     │                           │
     │                           │ setImmediate (background)
     │                           ▼
     │                    ┌──────────────┐
     │                    │ ProcessTrans- │
     │                    │ criptionUseCase│
     │                    └──────┬───────┘
     │                           │
     │              ┌────────────┼────────────┐
     │              ▼            ▼            ▼
     │        ┌──────────┐ ┌──────────┐ ┌──────────┐
     │        │PdfJs     │ │Tesseract │ │Domain    │
     │        │Extractor │ │OCR       │ │Extractors│
     │        └──────────┘ └──────────┘ └──────────┘
     │                           │
     │  GET /:id (polling 2s)    │ complete()
     │◄──────────────────────────┘
     │
     │  PUT /:id (correções)
     │──────────────────────────►
     │
     │  GET /:id/planilha
     │──────────────────────────►  ┌──────────┐
     │◄──────────────────────────  │ExcelJs   │
     │   xlsx/csv/json             │Generator │
     │                             └──────────┘
```

---

## 7.3 Arquivos Críticos para Referência

| Arquivo                                                                              | O que contém                                                    | Por que é crítico                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/domain/src/transcription/entities/transcription.entity.ts`                 | Entidade principal, máquina de estados, domain events           | O coração do negócio — toda lógica de status vive aqui |
| `packages/domain/src/transcription/extractors/cartao-ponto.extractor.ts`             | Regex para datas + horários, criação de punches                 | A lógica de extração de cartão de ponto                |
| `packages/domain/src/transcription/extractors/holerite.extractor.ts`                 | Regex para competência + verbas + bases, separação fields/bases | A lógica de extração de holerite — decisão central     |
| `packages/domain/src/spreadsheet/services/spreadsheet-builder.service.ts`            | Construção de headers + rows, destaques                         | Transforma resultado em planilha                       |
| `packages/domain/src/transcription/services/warning-calculator.service.ts`           | Cálculo de warnings derivados                                   | Lógica de avisos (não armazenados)                     |
| `packages/domain/src/shared/utils/date-utils.ts`                                     | parseDateRaw, daysBetween                                       | Utilitários de data usados por todo o domain           |
| `packages/application/src/transcription/use-cases/process-transcription.use-case.ts` | Pipeline completo de processamento                              | O fluxo mais complexo do projeto                       |
| `packages/application/src/transcription/mappers/result-parser.ts`                    | parseResult — JSON → domain objects                             | Validação de input do PUT                              |
| `packages/infrastructure/src/di/container.ts`                                        | DI manual, wiring de dependências                               | Onde tudo é conectado                                  |
| `packages/infrastructure/src/web/routes/transcricoes.route.ts`                       | Rotas HTTP, validações de upload                                | Entry points da API                                    |
| `packages/infrastructure/src/pdf/pdfjs-extractor.adapter.ts`                         | groupByLine, renderPage                                         | Extração de texto de PDFs                              |
| `packages/infrastructure/src/ocr/tesseract-ocr.adapter.ts`                           | Worker reuse, recognize                                         | OCR local                                              |
| `packages/frontend/src/App.tsx`                                                      | Componente principal, debounce, polling                         | Fluxo do frontend                                      |
| `packages/frontend/src/hooks/useTranscricao.ts`                                      | React Query polling, cancelQueries                              | Gerencia estado da transcrição                         |
| `docs/ARCHITECTURE.md`                                                               | Documentação de arquitetura                                     | Referência oficial do projeto                          |

---

> [← Segurança e Testes](GUIA-06-SEGURANCA.md)

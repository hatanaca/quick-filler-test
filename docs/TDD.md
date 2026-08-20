# Guia de Testes / Testing Guide (PT-BR / EN)

## Português

### Ciclo TDD (Red → Green → Refactor)

Para CADA componente, nesta ordem:

1. **RED** — escreva o teste que falha (descreve o comportamento esperado)
2. **GREEN** — escreva o código mínimo para o teste passar
3. **REFACTOR** — melhore o código mantendo os testes verdes

Nunca escreva código de produção sem antes ter um teste falhando.

### Pirâmide de testes

```
        ╱╲
       ╱ E2E ╲          ← pipeline completo (upload → processar → baixar)
      ╱────────╲
     ╱ Integr.  ╲       ← rotas HTTP + adapters reais
    ╱────────────╲
   ╱   Unitários   ╲    ← domain (zero mocks) + application (mocks nos ports)
  ╱──────────────────╲
```

| Camada         | Tipo                                 | Mocks?                        |
| -------------- | ------------------------------------ | ----------------------------- |
| Domain         | Unitário (VOs, entidades, serviços)  | Nenhum — é puro               |
| Application    | Unitário (use cases)                 | Sim — apenas nos ports        |
| Infrastructure | Integração (rotas, upload, pipeline) | Nenhum — adapters reais       |
| Frontend       | Unitário (componentes React)         | Sim — Testing Library + jsdom |
| E2E            | Ciclo completo via Playwright        | Nenhum                        |

### Convenções

- Um teste por comportamento: `it('rejeita transição de ERRO para CONCLUIDO')`
- Descreva em PT-BR (legível pelo recrutador)
- Arrange → Act → Assert
- Golden files: `tests/fixtures/*.json` com o resultado esperado da extração
- Teste de erro tão importante quanto teste de sucesso (`?`, datas impossíveis,
  PDF corrompido, money float)

### Rodando

```bash
npm run test:unit         # domain + application
npm run test:domain       # apenas domain
npm run test:frontend     # componentes React (Vitest + Testing Library)
npm run test:integration  # rotas + pipeline E2E (PDFs reais em fixtures)
npm run test:e2e          # testes end-to-end (Playwright, precisa de build + servidor)
npm run test:coverage     # thresholds: domain >= 90%, application >= 80%
```

### Onde colocar

- `tests/unit/domain/` — espelha `packages/domain/src`
- `tests/unit/application/` — use cases
- `tests/unit/infrastructure/` — config, adapters
- `tests/integration/` — rotas e pipeline
- `tests/e2e/` — testes end-to-end (Playwright)
- `tests/fixtures/pdfs/` — PDFs sintéticos (`npm run test-pdfs`)
- `packages/frontend/src/components/*.test.tsx` — componentes React

## English

### TDD cycle (Red → Green → Refactor)

For EACH component, in this order:

1. **RED** — write the failing test (describes expected behavior)
2. **GREEN** — write the minimal code to make it pass
3. **REFACTOR** — improve the code while keeping tests green

Never write production code without a failing test first.

### Test pyramid

| Layer          | Type                                   | Mocks?                        |
| -------------- | -------------------------------------- | ----------------------------- |
| Domain         | Unit (VOs, entities, services)         | None — it is pure             |
| Application    | Unit (use cases)                       | Yes — only at ports           |
| Infrastructure | Integration (routes, upload, pipeline) | None — real adapters          |
| Frontend       | Unit (React components)                | Yes — Testing Library + jsdom |
| E2E            | Full cycle via Playwright              | None                          |

### Conventions

- One test per behavior: `it('rejects ERRO → CONCLUIDO transition')`
- Arrange → Act → Assert
- Golden files: `tests/fixtures/*.json` with expected extraction output
- Error tests are as important as success tests (`?`, impossible dates,
  corrupted PDF, float money)

### Running

```bash
npm run test:unit         # domain + application
npm run test:domain       # domain only
npm run test:frontend     # React components (Vitest + Testing Library)
npm run test:integration  # routes + E2E pipeline (real PDFs in fixtures)
npm run test:e2e          # end-to-end (Playwright, requires build + server)
npm run test:coverage     # thresholds: domain >= 90%, application >= 80%
```

### Where to place

- `tests/unit/domain/` — mirrors `packages/domain/src`
- `tests/unit/application/` — use cases
- `tests/unit/infrastructure/` — config, adapters
- `tests/integration/` — routes and pipeline
- `tests/e2e/` — end-to-end tests (Playwright)
- `tests/fixtures/pdfs/` — synthetic PDFs (`npm run test-pdfs`)
- `packages/frontend/src/components/*.test.tsx` — React components

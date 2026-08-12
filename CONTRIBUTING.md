# Como Contribuir / How to Contribute

## Português

### Pré-requisitos

- Node.js >= 22
- `npm install` na raiz

### Fluxo de trabalho

1. Crie uma branch: `feat/nome-da-feature` ou `fix/nome-do-bug`
2. Desenvolva seguindo TDD: **teste falha → implementação mínima → refactor**
3. Rode as verificações antes do PR:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
4. Abra um Pull Request usando o template

### Commits (Conventional Commits)

```
feat: add holerite spreadsheet export
fix: reject non-PDF uploads by magic bytes
test: cover warning calculator edge cases
docs: document retention policy
chore: bump fastify to 5.x
```

### Arquitetura (DDD)

- `domain/` — lógica pura, zero dependências externas, sem mocks nos testes
- `application/` — use cases; dependem apenas de `domain` (ports)
- `infrastructure/` — implementa ports (Fastify, Tesseract, pdfjs, ExcelJS)
- Nunca importe `infrastructure` dentro de `domain` ou `application`

### Segurança

- Nunca commite `.env`, tokens ou chaves
- Arquivos de upload: sempre UUID, nunca nome original (PII)
- Logs: use o logger com redação de PII
- Novas dependências: `npm audit` deve passar sem high/critical

## English

### Prerequisites

- Node.js >= 22
- `npm install` at the root

### Workflow

1. Create a branch: `feat/feature-name` or `fix/bug-name`
2. Develop with TDD: **failing test → minimal implementation → refactor**
3. Run checks before the PR:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
4. Open a Pull Request using the template

### Commits (Conventional Commits)

```
feat: add holerite spreadsheet export
fix: reject non-PDF uploads by magic bytes
test: cover warning calculator edge cases
docs: document retention policy
chore: bump fastify to 5.x
```

### Architecture (DDD)

- `domain/` — pure logic, zero external dependencies, no mocks in tests
- `application/` — use cases; depend only on `domain` (ports)
- `infrastructure/` — implements ports (Fastify, Tesseract, pdfjs, ExcelJS)
- Never import `infrastructure` inside `domain` or `application`

### Security

- Never commit `.env`, tokens or keys
- Upload files: always UUID, never original name (PII)
- Logs: use the PII-redacting logger
- New dependencies: `npm audit` must pass without high/critical

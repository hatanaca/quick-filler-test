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
   npm test              # unit + integration
   npm run test:frontend # componentes React
   npm run test:e2e      # Playwright (requer build + servidor rodando)
   ```
4. Abra um Pull Request usando o template

### Commits (Conventional Commits)

Utilize o padrão Conventional Commits com **scope** para indicar a área alterada:

```
feat(domain): add holerite spreadsheet export
fix(infra): reject non-PDF uploads by magic bytes
test(domain): cover warning calculator edge cases
docs: document retention policy
chore(deps): bump fastify to 5.x
```

**Scopes disponíveis:** `domain`, `infra`, `frontend`, `app`, `deps`, `ci`, `test`

**Regras de atomicidade:**

- Cada commit deve conter apenas alterações de **uma área** (domínio, infraestrutura, frontend, etc.)
- Máximo de **20-30 arquivos** por commit
- Se um fix afeta domínio + infra, divida em dois commits separados
- Evite commits que misturam features, fixes e docs

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
   npm test              # unit + integration
   npm run test:frontend # React components
   npm run test:e2e      # Playwright (requires build + running server)
   ```
4. Open a Pull Request using the template

### Commits (Conventional Commits)

Use Conventional Commits with **scope** to indicate the changed area:

```
feat(domain): add holerite spreadsheet export
fix(infra): reject non-PDF uploads by magic bytes
test(domain): cover warning calculator edge cases
docs: document retention policy
chore(deps): bump fastify to 5.x
```

**Available scopes:** `domain`, `infra`, `frontend`, `app`, `deps`, `ci`, `test`

**Atomicity rules:**

- Each commit should contain changes from only **one area** (domain, infrastructure, frontend, etc.)
- Maximum of **20-30 files** per commit
- If a fix affects domain + infra, split into two separate commits
- Avoid commits that mix features, fixes, and docs

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

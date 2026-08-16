# 2. Arquitetura: DDD + Hexagonal

> [← Voltar ao índice](GUIA.md)

## 2.1 Por Que DDD?

**DDD (Domain-Driven Design)** é uma abordagem onde o código reflete o domínio do negócio. Em vez de organizar o código por "controllers", "services", "repositories", organiza por **contextos de negócio** (Transcription, Spreadsheet).

**Benefícios concretos neste projeto:**

- O código de extração de cartão de ponto (`CartaoPontoExtractor`) está isolado — pode ser testado sem HTTP, sem banco, sem nada.
- As regras de negócio (ex: "valores monetários são sempre string") estão no domínio, não espalhadas pelo código.
- Se amanhã você quiser trocar Fastify por Express, só muda a infraestrutura — o domínio não muda.

## 2.2 Por Que Hexagonal?

**Arquitetura Hexagonal** (também chamada de Ports & Adapters) é o padrão que permite trocar qualquer componente externo sem afetar o núcleo.

**Analogia:** Imagine um carregador de celular. A tomada (porta) é sempre a mesma, mas você pode usar um adaptador para tomada americana, europeia, etc. O carregador não precisa saber qual tomada você está usando.

**No projeto:**

- **Porta:** `PdfExtractorPort` (interface que define "extrair texto de um PDF")
- **Adaptador:** `PdfJsExtractorAdapter` (implementação concreta com pdfjs-dist)
- Se amanhã você quiser usar outra biblioteca de PDF, cria um novo adaptador implementando a mesma porta.

## 2.3 Monorepo com npm Workspaces

```
packages/
├── domain/          ← O coração: entidades, value objects, serviços, ports
├── application/     ← Orquestração: use cases, DTOs, event bus
├── infrastructure/  ← Detalhes: Fastify, OCR, PDF, exporters, DI
└── frontend/        ← Interface: React (independente, fala com API via HTTP)
```

**Por que monorepo?** Todos os pacotes estão no mesmo repositório. Facilita refatorações que cruzam camadas (ex: adicionar um campo no domínio e na API).

## 2.4 Regra de Dependências (A Regra Mais Importante)

```
domain         → (ZERO dependências externas — TypeScript puro)
application    → domain
infrastructure → application + domain
frontend       → independente (HTTP)
```

**Tradução:**

- `domain` NÃO pode importar nada de fora. É código puro, testável, sem efeitos colaterais.
- `application` pode importar de `domain` (para usar entidades, value objects, ports).
- `infrastructure` pode importar de ambos (para implementar ports e orquestrar use cases).
- `frontend` é completamente independente — se comunica com o backend via HTTP.

**Por que isso importa?** Se você violar essa regra (ex: `domain` importando `infrastructure`), o código fica acoplado e não pode mais ser testado isoladamente.

## 2.5 Bounded Contexts

**Bounded Context** é um termo do DDD que significa "área do negócio com regras próprias".

| Contexto          | O que faz                                       | Aggregate Root                  |
| ----------------- | ----------------------------------------------- | ------------------------------- |
| **Transcription** | Upload, processamento, extração, revisão        | `Transcription`                 |
| **Spreadsheet**   | Transformar resultado em planilha com destaques | `SpreadsheetExport` (stateless) |

**Por que dois contextos?** São responsabilidades diferentes. Transcription lida com "o que o documento diz". Spreadsheet lida com "como apresentar isso em planilha". Misturar os dois criaria código confuso.

---

> [← Introdução](GUIA-01-INTRODUCAO.md) | [Domínio →](GUIA-03-DOMINIO.md)

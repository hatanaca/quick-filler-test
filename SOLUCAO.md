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

### Docker

```bash
docker compose up --build
# backend: http://localhost:3001 · frontend: http://localhost:5173
```

### Verificações

```bash
npm run lint && npm run typecheck && npm test
```

## Stack

A vaga pedia TypeScript. O strict mode combina bem com classes e interfaces, o que facilita a separação de camadas do DDD. Fastify foi escolhido sobre Express pela performance e validação de schema nativa.

Para OCR, Tesseract.js local — sem custo, sem API key, roda offline. O pdfjs-dist extrai texto dos PDFs, reconstruindo linhas pela posição Y (PDFs reais não têm quebras de linha limpas). ExcelJS gera as planilhas xlsx.

## Arquitetura

DDD com Ports & Adapters (Hexagonal):

- `packages/domain` — camada pura, sem dependências externas. Entidades, value objects (`Money` como string, nunca float), serviços e ports.
- `packages/application` — use cases e event bus em memória. Testes com mocks nos ports.
- `packages/infrastructure` — Fastify, middlewares de segurança, adapters reais, DI manual.
- `packages/frontend` — React, polling de status, tabela editável com destaques, download.

## TDD

O projeto foi desenvolvido com agentes de IA desde o início. TDD entrou como proteção: testes primeiro reduzem o espaço para o agente gerar código incorreto. Os testes definem a especificação.

## Processamento

`POST /api/transcricoes` retorna 202 e o processamento roda em background. O cliente acompanha o status por polling em `GET /api/transcricoes/:id`.

O parser de páginas usa uma pool de workers com concorrência limitada (configurável via `OCR_WORKER_POOL_SIZE`). Páginas escaneadas são renderizadas e enviadas ao OCR em paralelo, com limite de threads para não estourar memória. O Tesseract é intensivo em CPU — sem essa separação, uma transcrição com muitas páginas travaria o container.

## Infraestrutura e deploy

O servidor roda em um Arch Linux doméstico. O IP público é dinâmico, então configurei DDNS no roteador para manter o domínio fixo. Com a aplicação pública, adicionei TLS — o fluxo é: cliente → DDNS → Hostinger (gateway com SSL) → servidor local. Utilizei um domínio próprio que tenho com vencimento em 01/09.

## Segurança

Middlewares de validação implementados: upload verificado por magic bytes (não por extensão), limite de 20MB, nomes de arquivo sanitizados como UUID, rate limiting, helmet, CORS whitelist e redação automática de PII nos logs (CPF, matrícula, e-mail).

## Testes

- `money.vo` — formato brasileiro e `?` como base da honestidade dos dados
- `warning-calculator` — avisos derivados que regem os destaques
- `extractors` — separação fields/bases e ordem do documento
- `pipeline` (E2E) — ciclo completo: enviar → processar → revisar → baixar
- `upload-security` — magic bytes, limite, sanitização
- Componentes React (Testing Library) e E2E (Playwright)

## OCR

Tesseract.js local, modelo `por`. Páginas sem texto são renderizadas como imagem e enviadas ao OCR após pré-processamento (grayscale, contraste, binarização, deskew). O processamento usa pool de workers configurável para paralelizar o OCR de múltiplas páginas com limite de concorrência. Caracteres com confiança abaixo do limiar viram `?`. Resultados ilegíveis saem vazios.

## Layouts suportados

| Tipo         | Layout                                   | Documento            |
| ------------ | ---------------------------------------- | -------------------- |
| cartao-ponto | padrão (`dd/mm/yyyy` + batidas na linha) | `cartao-ponto-1.pdf` |
| cartao-ponto | FOLHA DE FREQUÊNCIA (SIPON)              | `time-card-01.pdf`   |
| cartao-ponto | Banco do Brasil — Ponto Eletrônico (OCR) | `time-card-02.pdf`   |
| cartao-ponto | Cartão de Ponto com datas (OCR)          | `time-card-03.pdf`   |
| holerite     | padrão (código 4 dígitos)                | `holerite-1.pdf`     |
| holerite     | FICHA FINANCEIRA (multi-mês; bônus)      | `payroll-01.pdf`     |
| holerite     | Declaração Remuneração (MÊS/ACERTO)      | `payroll-02.pdf`     |
| holerite     | Demonstrativo de Pagamento               | `payroll-03.pdf`     |
| holerite     | Recibo de Pagamento (OCR)                | `payroll-04.pdf`     |

## O que ficou de fora

Documentos ilegíveis (como `time-card-04.pdf`) saem com resultado vazio. Não implementei rastreabilidade visual nem detecção automática de tipo de documento. O banco em memória atende à retenção curta; a interface permite trocar por banco relacional sem alterar o domínio.

## Autoavaliação

Extração funciona bem em PDFs com texto embutido. OCR é funcional mas depende da qualidade da digitalização. O ciclo completo está validado com testes E2E e Docker. A arquitetura mantém as camadas claras sem overengineering. Segurança cobre os pontos essenciais.

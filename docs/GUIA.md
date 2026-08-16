# Quick Filler — Guia Completo do Projeto (Expandido)

## 1. O Que é Este Projeto?

**Quick Filler** é uma aplicação web que resolve um problema real: transcrever documentos trabalhistas brasileiros (cartões de ponto e holerites) que estão em PDF para planilhas estruturadas.

**O problema:** Empresas brasileiras têm montanhas de documentos trabalhistas em PDF — cartões de ponto (registro diário de entrada/saída) e holerites (contracheques). Extrair dados desses PDFs manualmente é lento e sujeito a erros.

**A solução:** O usuário faz upload do PDF, a aplicação extrai os dados automaticamente (usando OCR se necessário), mostra uma tabela editável lado a lado com o PDF original, permite correções, e gera uma planilha limpa para download.

**É um desafio técnico** da empresa Quick Filler — não é um produto em produção, mas sim um projeto que demonstra competências em arquitetura de software, DDD, e resolução de problemas reais.

---

## 2. Por Que Esta Stack? (Cada Tecnologia Explicada)

### TypeScript (não JavaScript puro)

- **Por que:** O projeto lida com dados complexos (datas, valores monetários, estruturas de pagamento). TypeScript permite definir tipos que impedem erros em tempo de compilação.
- **Strict mode:** Todas as verificações ativadas — `null` checks, tipo `any` proibido, etc.
- **`noUncheckedIndexedAccess`:** Quando você acessa `array[0]`, TypeScript retorna `T | undefined` em vez de `T`. Isso força você a tratar o caso de array vazio.
- **`verbatimModuleSyntax`:** Importações devem ser explícitas sobre se são tipos ou valores. Isso evita bugs de runtime onde você importa algo que só existe em tipo.
- **`module: "NodeNext"`:** Usa ESM (módulos ES) com extensões `.js` nas importações — o padrão moderno do Node.js.

### Node.js 22+

- **Por que:** Runtime JavaScript server-side. Versão 22+ porque suporta top-level `await`, `crypto.randomUUID()` nativo, e outras features modernas.

### Fastify (não Express)

- **Por que:** Framework HTTP mais rápido que Express, com tipagem forte e schema validation nativo. O schema validation permite validar o body da request antes de chegar no handler.
- **Alternativa considerada:** Express — mais popular, mas mais lento e sem tipagem nativa.

### React 18 + Vite (frontend)

- **Por que:** React é o framework frontend mais usado. Vite é o bundler mais rápido para desenvolvimento (hot reload instantâneo).
- **React 18:** Suporta concurrent features, mas o projeto usa principalmente hooks tradicionais.

### TanStack React Query (estado do servidor)

- **Por que:** Gerencia o estado do servidor (dados da API) separado do estado do componente. Faz caching, retry, e polling automaticamente.
- **Sem ele:** Você teria que gerenciar manualmente `useState` + `useEffect` + fetch + loading + error para cada chamada de API.

### Tesseract.js (OCR local)

- **Por que:** OCR (Reconhecimento Óptico de Caracteres) que roda localmente, sem custo, sem API key, sem internet. Processa imagens e extrai texto.
- **Alternativa considerada:** Google Vision API — mais preciso, mas custa dinheiro e precisa de API key.
- **Worker pool:** O OCR é intensivo em memória. O projeto usa um pool de workers (padrão: 2) para processar páginas em paralelo sem estourar a memória.

### pdfjs-dist (extração de PDF)

- **Por que:** Biblioteca da Mozilla para ler PDFs. Extrai texto embutido (PDFs digitais) e renderiza páginas como imagens (para OCR de PDFs escaneados).
- **@napi-rs/canvas:** Implementação de Canvas para Node.js (necessária para renderizar PDFs como imagens).

### ExcelJS (geração de planilhas)

- **Por que:** Gera arquivos .xlsx com formatação (cores, bordas, fontes). Suporta CSV e JSON também.
- **csv-stringify:** Alternativa leve para gerar CSV (usado em conjunto com ExcelJS).

### Vitest (testes)

- **Por que:** Test runner moderno, rápido, compatível com Vite. Suporta coverage com V8.
- **Alternativa considerada:** Jest — mais lento, configuração mais complexa com ESM.

### ESLint 9 + Prettier (qualidade)

- **ESLint:** Encontra bugs e problemas de código. Versão 9 com flat config (mais simples).
- **Prettier:** Formata código automaticamente (indent, aspas, etc.).
- **Husky + lint-staged:** Hooks do git que rodam lint e format automaticamente antes de cada commit.

---

## 3. Arquitetura: DDD + Hexagonal (Ports & Adapters)

### 3.1 Por Que DDD?

**DDD (Domain-Driven Design)** é uma abordagem onde o código reflete o domínio do negócio. Em vez de organizar o código por "controllers", "services", "repositories", organiza por **contextos de negócio** (Transcription, Spreadsheet).

**Benefícios concretos neste projeto:**

- O código de extração de cartão de ponto (`CartaoPontoExtractor`) está isolado — pode ser testado sem HTTP, sem banco, sem nada.
- As regras de negócio (ex: "valores monetários são sempre string") estão no domínio, não espalhadas pelo código.
- Se amanhã você quiser trocar Fastify por Express, só muda a infraestrutura — o domínio não muda.

### 3.2 Por Que Hexagonal?

**Arquitetura Hexagonal** (também chamada de Ports & Adapters) é o padrão que permite trocar qualquer componente externo sem afetar o núcleo.

**Analogia:** Imagine um carregador de celular. A tomada (porta) é sempre a mesma, mas você pode usar um adaptador para tomada americana, europeia, etc. O carregador não precisa saber qual tomada você está usando.

**No projeto:**

- **Porta:** `PdfExtractorPort` (interface que define "extrair texto de um PDF")
- **Adaptador:** `PdfJsExtractorAdapter` (implementação concreta com pdfjs-dist)
- Se amanhã você quiser usar outra biblioteca de PDF, cria um novo adaptador implementando a mesma porta.

### 3.3 Monorepo com npm Workspaces

```
packages/
├── domain/          ← O coração: entidades, value objects, serviços, ports
├── application/     ← Orquestração: use cases, DTOs, event bus
├── infrastructure/  ← Detalhes: Fastify, OCR, PDF, exporters, DI
└── frontend/        ← Interface: React (independente, fala com API via HTTP)
```

**Por que monorepo?** Todos os pacotes estão no mesmo repositório. Facilita refatorações que cruzam camadas (ex: adicionar um campo no domínio e na API).

### 3.4 Regra de Dependências (A Regra Mais Importante)

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

### 3.5 Bounded Contexts

**Bounded Context** é um termo do DDD que significa "área do negócio com regras próprias".

| Contexto          | O que faz                                       | Aggregate Root                  |
| ----------------- | ----------------------------------------------- | ------------------------------- |
| **Transcription** | Upload, processamento, extração, revisão        | `Transcription`                 |
| **Spreadsheet**   | Transformar resultado em planilha com destaques | `SpreadsheetExport` (stateless) |

**Por que dois contextos?** São responsabilidades diferentes. Transcription lida com "o que o documento diz". Spreadsheet lida com "como apresentar isso em planilha". Misturar os dois criaria código confuso.

---

## 4. Conceitos e Termos do Domínio (Explicados em Detalhe)

### 4.1 Documentos Trabalhistas Brasileiros

**Cartão de Ponto:**

- Documento que registra as entradas e saídas diárias do trabalhador.
- Cada dia tem uma ou mais "batidas" (punches) — entrada e saída.
- Exemplo de linha no PDF: `15/01/2024  08:00  12:00  13:00  17:30`
  - 15/01/2024 = data
  - 08:00 = entrada 1 (IN)
  - 12:00 = saída 1 (OUT)
  - 13:00 = entrada 2 (IN)
  - 17:30 = saída 2 (OUT)

**Holerite (Contracheque):**

- Documento que mostra o salário, descontos e valores líquidos.
- Tem uma tabela de "verbas" (código, descrição, referência, valor).
- Exemplo de verba: `0010 Salário Base  220,00  2.389,77`
  - 0010 = código da verba
  - Salário Base = label (descrição)
  - 220,00 = referência (dias trabalhados, horas, etc.)
  - 2.389,77 = valor
- Além das verbas, tem "bases de cálculo" (Base INSS, Base IR, FGTS, etc.)

### 4.2 Value Objects — Por Que Existem

**Value Object** é um objeto que:

- Não tem identidade (dois Money com valor "1.000,00" são iguais)
- É imutável (uma vez criado, não muda)
- Valida suas próprias regras

**Por que não usar primitivos (string, number)?**

- Se `id` fosse `string`, qualquer string seria aceita como ID (inclusive path traversal).
- Com `TranscriptionId`, só UUIDs válidos são aceitos — a validação está no construtor.

### 4.3 Value Objects Detalhados

#### `TranscriptionId` — Identificador Único

```typescript
const TRANSCRIPTION_ID_BRAND = Symbol('TranscriptionId')
// Branded type: impede que uma string qualquer seja usada como ID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

- **Branded type com Symbol:** Técnica TypeScript onde você adiciona uma propriedade única (Symbol) ao tipo. Isso impede que uma `string` qualquer seja atribuída a `TranscriptionId` — só IDs criados com `TranscriptionId.from()` são aceitos.
- **Validação UUID:** Impede path traversal (ex: `../../etc/passwd` como ID) e injeção em headers HTTP.

#### `DocumentType` — Tipo de Documento

```typescript
export const DocumentType = {
  CARTAO_PONTO: 'cartao-ponto',
  HOLERITE: 'holerite',
} as const
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType]
```

- **Const object + type alias** (não `enum`): Em TypeScript, `enum` gera código JavaScript extra. `as const` + type alias é mais leve e tipado.
- **`as const`:** Diz ao TypeScript que os valores são literais (não `string` genérico).

#### `TranscriptionStatus` — Máquina de Estados

```
PROCESSANDO → CONCLUIDO
PROCESSANDO → ERRO
```

- Transições válidas: só de `PROCESSANDO` para `CONCLUIDO` ou `ERRO`.
- Transições inválidas: `CONCLUIDO → ERRO` (lança erro), `ERRO → CONCLUIDO` (lança erro).
- A entidade NÃO é idempotente — chamar `complete()` duas vezes lança erro. A idempotência está no use case.

#### `Punch` — Uma Batida de Ponto

```typescript
kind: 'IN' | 'OUT' // entrada ou saída
time_raw: '8:25' // como aparece no documento
time_hhmm: '08:25' // normalizado para HH:MM 24h
```

- **`time_raw` vs `time_hhmm`:** O documento pode ter "8:25" (sem zero à esquerda). `time_hhmm` normaliza para "08:25" para facilitar comparações.
- **`?` de incerteza:** Se o OCR não conseguiu ler um dígito, fica `?` (ex: "?8:25").

#### `Money` — Valor Monetário

```typescript
// SEMPRE string no formato brasileiro — nunca float
Money.from('2.389,77') // válido
Money.from('2389.77') // ERRO — formato americano
Money.from(2389.77) // ERRO — não é string
Money.from('????') // válido — incerteza total
```

- **Por que string e não number?** Valores monetários com ponto flutuante causam erros de arredondamento (ex: `0.1 + 0.2 !== 0.3`). String preserva o formato exato do documento.
- **Incerteza:** `?` pode substituir qualquer dígito. `????` significa "não foi possível ler o valor".

#### `DayRecord` — Um Dia no Cartão

```typescript
date_raw: '15/01/2024'    // data como aparece no documento
punches: [Punch, ...]     // batidas do dia
```

- **`isOddPunches()`:** Se tem número ímpar de batidas, falta entrada ou saída (warning).
- **`isDateNonSequential()`:** Se a data não é consecutiva à anterior, pode ser erro de leitura.

#### `PageHolerite` — Uma Página de Holerite

```typescript
page: 1                    // número da página (1-indexed)
year: '2024'               // ano da competência
month: '01'                // mês da competência (01-12)
fields: PayrollField[]     // verbas da tabela principal
bases: PayrollBase[]       // bases de cálculo (seção separada)
```

- **`isEmpty()`:** Página existe no PDF mas nenhum dado saiu (warning).
- **`hasUncertainty()`:** Algum campo tem `?` (warning).

### 4.4 Entidade `Transcription` — O Aggregate Root

```typescript
class Transcription {
  private _id: TranscriptionId
  private _tipo: DocumentType
  private _status: TranscriptionStatus // PROCESSANDO → CONCLUIDO | ERRO
  private _erro: string | null
  private _value: TranscriptionResult | null
  private _createdAt: Date
  private _updatedAt: Date
  private _events: DomainEvent[]
}
```

**Métodos e suas regras:**

- `Transcription.create(params)` — Cria entidade com status PROCESSANDO, emite `TranscriptionCreated`
- `complete(result)` — Só funciona se status for PROCESSANDO. Muda para CONCLUIDO, emite `TranscriptionCompleted`
- `fail(error)` — Só funciona se status for PROCESSANDO. Muda para ERRO, emite `TranscriptionFailed`
- `updateValue(value)` — Só funciona se status for CONCLUIDO. Atualiza value, emite `TranscriptionUpdated`
- `pullEvents()` — Retorna e limpa eventos acumulados (padrão Domain Events)

**Por que Domain Events?** Em vez de chamar side effects diretamente (ex: "salvar no banco" dentro de `complete()`), a entidade emite eventos. Quem quiser reagir a esses eventos se inscreve no Event Bus. Isso desacopla a entidade de qualquer infraestrutura.

### 4.5 Ports — Contratos no Domain

**Port** é uma interface (TypeScript `interface`) que define "o que precisa existir" sem dizer "como implementar".

```typescript
// Domain define O QUE precisa
interface PdfExtractorPort {
  extractPages(buffer: Buffer): Promise<string[]>
  renderPage(pageIndex: number, buffer: Buffer): Promise: Promise<Buffer>
}

// Infrastructure implementa COMO
class PdfJsExtractorAdapter implements PdfExtractorPort {
  async extractPages(buffer: Buffer): Promise<string[]> {
    // usa pdfjs-dist para extrair texto
  }
}
```

**Por que separar?** O domain não precisa saber qual biblioteca de PDF você usa. Se amanhã trocar pdfjs-dist por outra coisa, só muda o adapter — o domain não muda.

### 4.6 Adapters — Implementações Concretas

| Adapter                           | Port que implementa        | O que faz                                                                                                               |
| --------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PdfJsExtractorAdapter`           | `PdfExtractorPort`         | Extrai texto de PDFs usando pdfjs-dist. Renderiza páginas como PNG para OCR. Usa `page.cleanup()` para liberar memória. |
| `TesseractOcrAdapter`             | `OcrEnginePort`            | OCR local com Tesseract.js. Worker é criado uma vez e reutilizado (warm start ~2s).                                     |
| `InMemoryTranscriptionRepository` | `TranscriptionRepository`  | Armazena transcrições em `Map<string, Transcription>`. Tem `deleteOlderThan()` para cleanup (NÃO está no port).         |
| `DiskFileStorage`                 | `FileStoragePort`          | Salva PDFs em disco com nome UUID (sem PII). Cria diretório automaticamente.                                            |
| `ExcelJsGeneratorAdapter`         | `SpreadsheetGeneratorPort` | Gera xlsx com formatação (cores, bordas), csv com BOM UTF-8, e json.                                                    |

---

## 5. Lógica de Negócio — Passo a Passo

### 5.1 O Fluxo Completo (com detalhes de cada etapa)

#### Etapa 1: Upload (POST /api/transcricoes)

```
Frontend → Fastify Route → CreateTranscriptionUseCase
```

**O que acontece no route (`transcricoes.route.ts`):**

1. `ProcessingQueue.run(request.ip, ...)` — Limita uploads simultâneos por IP (padrão: 3). Se exceder, retorna 429.
2. Lê o multipart/form-data: campo `arquivo` (PDF) e campo `tipo` ("cartao-ponto" ou "holerite").
3. Validações:
   - `isPdfMagicBytes(arquivo)` — Checa se os primeiros 5 bytes são `%PDF-` (nunca confia em extensão ou MIME).
   - `isUploadTooLarge(arquivo, maxBytes)` — Limite de 20MB.
   - `isDocumentType(tipo)` — Tipo válido.
4. Chama `CreateTranscriptionUseCase.execute(...)`.
5. Retorna `202 { id }` (Accepted — processamento é assíncrono).

**O que acontece no use case (`create-transcription.use-case.ts`):**

1. Gera UUID com `crypto.randomUUID()`.
2. Cria entidade `Transcription` (status=PROCESSANDO).
3. Salva no repositório (`repository.save()`).
4. Salva arquivo no disco (`storage.save(id, buffer)`).
5. Publica evento `TranscriptionCreated` via Event Bus.
6. Retorna o ID.

**O que acontece DEPOIS do response (background):**

```typescript
setImmediate(() => {
  deps.processTranscription.execute(TranscriptionId.from(id.value))
})
```

- `setImmediate()` agenda o processamento para o próximo tick do event loop.
- O response HTTP já foi enviado — o cliente não espera o processamento.

#### Etapa 2: Processamento (ProcessTranscriptionUseCase)

```
Read PDF → Extract Text → OCR (se necessário) → Parse → Complete
```

**Passo a passo:**

1. Busca transcrição no repositório. Se não existe, lança `TranscriptionNotFoundError`.
2. **Idempotência:** Se status não é PROCESSANDO, retorna (não reprocessa).
3. Lê arquivo do disco (`storage.read(id)`).
4. Extrai texto por página (`pdfExtractor.extractPages(buffer)`).
   - PDFs digitais: retorna texto embutido.
   - PDFs escaneados: retorna string vazia.
5. Para cada página vazia (escaneada):
   - Renderiza página como PNG (`pdfExtractor.renderPage(index, buffer)`).
   - Roda OCR (`ocrEngine.recognize(image)`).
6. **Controle de concorrência:** `runWithConcurrency()` processa páginas em paralelo com limite (padrão: 2). Isso evita estourar memória com Tesseract.
7. Chama o extrator correto (`extractorFor(tipo).extract(texts)`).
8. Chama `transcription.complete(result)`.
9. Salva no repositório.

#### Etapa 3: Polling (GET /api/transcricoes/:id)

**No frontend (`useTranscricao.ts`):**

```typescript
const query = useQuery({
  queryKey: ['transcricao', id],
  queryFn: () => getTranscription(id),
  refetchInterval: (query) => (query.state.data?.status === 'processando' ? 2000 : false),
})
```

- React Query faz polling a cada 2s enquanto status for "processando".
- Quando status é terminal (concluido/erro), `refetchInterval` retorna `false` (para de fazer polling).
- `cancelQueries` cancela polls em voo para evitar reverter estado com resposta atrasada.
- `retry: 1` — Uma tentativa extra em caso de falha transitória.

**No backend:**

- Busca transcrição no repositório.
- Serializa para JSON (via `toResponse()` mapper).
- Retorna `{ id, tipo, status, erro, value }`.

#### Etapa 4: Correções (PUT /api/transcricoes/:id)

**No frontend (`App.tsx`):**

```typescript
const handleChange = useCallback(
  (value) => {
    // Debounce: salva 500ms após a última edição
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateTranscription(id, value)
    }, 500)
  },
  [id],
)
```

- Debounce evita salvar a cada tecla digitada.
- Após 500ms sem edição, salva via PUT.

**No backend:**

1. Valida body tem campo `value`.
2. `parseResult(tipo, body.value)` — Converte JSON em domain objects validados.
   - Para cartão: cria `PageCartaoPonto[]` com `DayRecord[]` e `Punch[]`.
   - Para holerite: cria `PageHolerite[]` com `PayrollField[]` e `PayrollBase[]`.
3. `updateTranscriptionUseCase.execute({ id, value })` — Atualiza entidade.
4. Salva no repositório.

#### Etapa 5: Exportação (GET /api/transcricoes/:id/planilha)

**No backend:**

1. Busca transcrição. Se não é CONCLUIDO, lança erro.
2. `SpreadsheetBuilder.build(result, tipo)` — Constrói headers + rows.
3. `generator.generate(formato, headers, rows)` — Gera buffer no formato pedido.
4. Retorna arquivo com headers `Content-Type` e `Content-Disposition`.

### 5.2 Extração de Cartão de Ponto (Detalhada)

**O problema:** O PDF tem linhas como:

```
15/01/2024  08:00  12:00  13:00  17:30
```

Precisamos extrair: data=15/01/2024, batidas=[IN 08:00, OUT 12:00, IN 13:00, OUT 17:30].

**Como funciona:**

1. Divide texto em linhas (`text.split('\n')`).
2. Para cada linha, tenta encontrar data com regex `/([0-9?]{2}\/[0-9?]{2}\/[0-9?]{4})/g`.
   - `[0-9?]` — dígito ou `?` (incerteza de OCR).
   - Ex: `15/01/2024` ou `1?/01/2024`.
3. Se não tem data, pula linha.
4. Encontra horários com regex `/([0-9?]{1,2}:[0-9?]{2})/g`.
   - `[0-9?]{1,2}` — 1 ou 2 dígitos (ex: "8" ou "08").
5. Cria punches em pares: índice par=IN, ímpar=OUT.
6. Normaliza horário: `"8:25"` → `"08:25"` (padStart 2).

**Exemplo de extração:**

```
Linha: "15/01/2024  08:00  12:00  13:00  17:30"
→ date_raw: "15/01/2024"
→ punches: [
    { kind: "IN",  time_raw: "08:00", time_hhmm: "08:00" },
    { kind: "OUT", time_raw: "12:00", time_hhmm: "12:00" },
    { kind: "IN",  time_raw: "13:00", time_hhmm: "13:00" },
    { kind: "OUT", time_raw: "17:30", time_hhmm: "17:30" }
  ]
```

### 5.3 Extração de Holerite (Detalhada)

**O problema:** O PDF tem uma estrutura como:

```
Competência: 01/2024

0010 Salário Base   220,00  2.389,77
0020 Hora Extra      10,00    217,25

Base INSS    2.607,02
Base IR      2.607,02
Valor Líquido  2.189,77
```

**Como funciona:**

1. Extrai competência com regex `/(?:Compet[eê]ncia|referente a|compet[eê]ncia)\s*[:.]?\s*(\d{2})\/(\d{4})/i`.
   - Captura mês (2 dígitos) e ano (4 dígitos).
   - Se não achar, usa `"0?"` e `"????"` (incerteza).

2. Para cada linha:
   - **Se começa com label de base** (`Base INSS`, `Base IR`, etc.):
     - Extrai último valor monetário da linha.
     - Cria `PayrollBase`.
   - **Se começa com código de 4 dígitos** (`/^(\d{4})\s+(.+)$/`):
     - `code` = primeiro token (ex: "0010").
     - `value` = último valor monetário (ex: "2.389,77").
     - `reference` = penúltimo valor (ex: "220,00"), se houver.
     - `label` = texto entre code e reference, sem money e sem traço final.
     - Cria `PayrollField`.

3. **Separação fields ≠ bases:** Esta é a decisão central.
   - `fields` = verbas da tabela principal (código, descrição, valores).
   - `bases` = seção separada abaixo (Base INSS, Valor Líquido, etc.).
   - Nunca confundir — são coisas diferentes no holerite.

**Regex de money:** `/(?:[0-9?]{1,3}(?:[.][0-9?]{3})+|[0-9?]+),[0-9?]{1,2}/g`

- `[0-9?]{1,3}(?:[.][0-9?]{3})+` — com separador de milhar (ex: "2.389,77").
- `[0-9?]+` — sem separador (ex: "77,00").
- `,` — vírgula decimal brasileira.
- `[0-9?]{1,2}` — 1 ou 2 casas decimais.

### 5.4 Regras de Incerteza (O Caractere `?`)

**O problema:** OCR nem sempre lê perfeitamente. Um "3" pode virar "8", um "0" pode sumir.

**A solução:** Em vez de adivinhar, o projeto usa `?` para caracteres não lidos.

**Regras:**

- Caractere não lido → `?` (nunca inventar valor).
- `????` em valor monetário é aceito (incerteza total).
- Datas com `?` são `unreadable` (não quebram cadeia de sequência).
- Datas impossíveis (`38/07`) são `impossible` (erro de leitura).

**Exemplo:**

```
Documento: "15/01/2024  08:00  1??:00  13:00  17:30"
→ time_raw: "?8:00" (primeiro dígito ilegível)
→ time_hhmm: "?8:00" (preserva incerteza)
```

### 5.5 Sistema de Warnings (Derivados, Nunca Armazenados)

**O problema:** Como saber se uma transcrição tem problemas?

**A solução:** Warnings são calculados na hora de exibir, nunca armazenados. Isso garante que os warnings sempre reflitam o estado atual dos dados.

**Cartão de Ponto:**

- `odd-punches`: Número ímpar de batidas (falta entrada ou saída).
- `non-sequential-date`: Data não consecutiva à anterior legível.

**Holerite:**

- `empty-page`: Página existe no PDF mas nenhum dado saiu.
- `non-sequential-month`: Mês não consecutivo ao anterior legível.

**Regras de sequência:**

- Dezembro → janeiro é consecutivo (ano novo).
- Competência ilegível (`?`) não quebra a cadeia (compara as próximas legíveis).
- Ordem do documento é preservada (nunca ordenar por data).

### 5.6 Construção da Planilha (SpreadsheetBuilder)

**Cartão de Ponto:**

- Headers: `["Data", "Entrada 1", "Saída 1", "Entrada 2", "Saída 2", ...]`
- Rows: Uma linha por dia, com data e horários.
- Número de colunas de batidas = maior número de batidas em qualquer dia.

**Holerite:**

- Headers: `["Pág.", "Mês", "Ano", "Salário Base", "Hora Extra", ...]`
- Rows: Uma linha por página.
- Labels de verbas = união de todos os labels, na ordem de primeira aparição.

**Destaques (RowHighlight):**

- Warning (amarelo `#FFF3CD`): Batidas ímpares, incerteza.
- Error (vermelho `#F8D7DA` + borda `#DC3545`): Data/mês não sequencial.
- Quando ambos se aplicam: vermelho ganha.

---

## 6. Decisões Arquiteturais (Com Mais Contexto)

### Fastify vs Express

- **Fastify:** 2-3x mais rápido, tipagem forte, schema validation nativo (valida body/query/params antes do handler).
- **Express:** Mais popular, mais middleware disponível, mas mais lento e sem tipagem nativa.
- **Decisão:** Fastify porque o projeto precisa de performance (uploads de PDF de até 20MB) e validação de schema.

### Tesseract.js Local vs Google Vision API

- **Tesseract.js:** Local, sem custo, sem API key, offline. Precisão ~90% para documentos brasileiros.
- **Google Vision:** Mais preciso (~~98%), mas custa dinheiro (~~$1.50 por 1000 páginas) e precisa de API key.
- **Decisão:** Tesseract porque é um desafio técnico (sem custo) e a precisão é suficiente com revisão humana.

### Polling vs SSE/WebSocket

- **Polling:** Frontend pergunta "terminou?" a cada 2s. Simples, funciona com qualquer infraestrutura.
- **SSE/WebSocket:** Server envia notificação quando termina. Mais eficiente, mas mais complexo.
- **Decisão:** Polling porque o contrato do desafio é simples e o tempo de processamento é curto (~5-30s).

### In-memory Repository vs Banco de Dados

- **In-memory:** Dados vivem na memória do processo. Quando o processo morre, dados somem.
- **Banco:** Dados persistem em disco. PostgreSQL, SQLite, etc.
- **Decisão:** In-memory porque a retenção é curta (60min) e não há necessidade de persistência. Trocar é fácil (implementar o port).

### DI Manual vs Framework (NestJS/typedi)

- **DI Manual:** `buildContainer()` cria tudo explicitamente. Simples, sem mágica.
- **NestJS/typedi:** Decorators, inversão de controle, mais abstrações.
- **Decisão:** DI manual porque o projeto é pequeno (5 use cases, 5 adapters). Framework seria overkill.

### Valores Monetários como String vs Float/Decimal

- **String:** `"2.389,77"` — preserva formato brasileiro, sem erros de arredondamento.
- **Float:** `2389.77` — erros de ponto flutuante (`0.1 + 0.2 !== 0.3`).
- **Decimal:** Preciso, mas precisa de biblioteca extra e conversões.
- **Decisão:** String porque o formato brasileiro deve ser preservado e o valor é apenas exibido/exportado (não calculado).

### Extração via Regex vs NLP/ML

- **Regex:** Determinístico, testável, rápido, suficiente para formatos conhecidos.
- **NLP/ML:** Mais flexível, mas precisa de treinamento, é mais lento, e pode errar.
- **Decisão:** Regex porque os formatos de cartão de ponto e holerite são previsíveis.

---

## 7. Padrões e Conceitos Técnicos (Explicados)

### 7.1 Domain-Driven Design (DDD)

**Entities:** Objetos com identidade. Dois objetos são iguais se têm o mesmo ID, não se têm os mesmos dados.

- Ex: `Transcription` — duas transcrições com o mesmo ID são a mesma coisa, mesmo que tenham dados diferentes.

**Value Objects:** Objetos sem identidade, imutáveis. Dois objetos são iguais se têm os mesmos dados.

- Ex: `Money("2.389,77")` — dois Money com o mesmo valor são iguais.

**Aggregate Root:** Entrada única para um grupo de objetos. Todas as modificações passam pelo aggregate root.

- Ex: `Transcription` é o aggregate root — para modificar um `DayRecord`, você modifica a `Transcription`.

**Domain Events:** Eventos que aconteceram no domínio. Não são comandos ("faça X"), são fatos ("X aconteceu").

- Ex: `TranscriptionCreated` — "uma transcrição foi criada". Quem quiser reagir se inscreve no Event Bus.

**Domain Services:** Lógica que não pertence a uma entidade.

- Ex: `WarningCalculator` — calcula warnings baseado em dados de múltiplas entidades.

**Ports:** Interfaces que definem contratos.

- Ex: `PdfExtractorPort` — "preciso de algo que extraia texto de PDF".

**Adapters:** Implementações concretas dos ports.

- Ex: `PdfJsExtractorAdapter` — "eu extraio texto usando pdfjs-dist".

### 7.2 Hexagonal (Ports & Adapters)

```
                    ┌─────────────────────────────────┐
                    │        Infrastructure            │
                    │  ┌───────────┐  ┌───────────┐   │
  HTTP ────────────►│  │  Fastify   │  │  Tesseract │   │
                    │  │  Routes    │  │  OCR       │   │
                    │  └─────┬─────┘  └─────┬─────┘   │
                    │        │              │          │
                    │  ┌─────▼──────────────▼─────┐   │
                    │  │     Application Layer      │   │
                    │  │  Use Cases + Event Bus     │   │
                    │  └─────────┬────────────────┘   │
                    │            │                     │
                    │  ┌─────────▼────────────────┐   │
                    │  │       Domain Layer         │   │
                    │  │  Entities + VOs + Services │   │
                    │  │  + Ports (interfaces)      │   │
                    │  └──────────────────────────┘   │
                    └─────────────────────────────────┘
```

**O que isso significa:**

- O exterior (HTTP, OCR, PDF) se conecta ao interior (domain) apenas via ports.
- O interior não sabe quem está do lado de fora.
- Você pode trocar qualquer componente exterior sem afetar o interior.

### 7.3 Use Cases (Application Layer)

**O que é um use case:** Uma classe que orquestra uma operação de negócio.

**Padrão:**

```typescript
class CreateTranscriptionUseCase {
  constructor(
    private readonly repository: TranscriptionRepository, // port
    private readonly storage: FileStoragePort, // port
    private readonly eventBus: EventBus, // port
  ) {}

  async execute(input: CreateTranscriptionInput): Promise<TranscriptionId> {
    // 1. Validar input
    // 2. Criar entidade
    // 3. Salvar
    // 4. Publicar evento
    // 5. Retornar resultado
  }
}
```

**Por que usar use cases?**

- Cada operação de negócio é isolada e testável.
- As dependências são injetadas via construtor (DI).
- O use case não sabe se está sendo chamado por HTTP, CLI, ou teste.

### 7.4 Event Bus

**O que é:** Um sistema de pub/sub síncrono em memória.

**Como funciona:**

```typescript
// Publicar
eventBus.publish(new TranscriptionCreated(id, tipo))

// Inscrever
const unsubscribe = eventBus.subscribe((event) => {
  if (event.type === 'transcription.created') {
    // reagir ao evento
  }
})

// Desinscrever
unsubscribe()
```

**Segurança:** Handlers que lançam exceção são capturados — não interrompem os demais nem derrubam o publish.

### 7.5 Processing Queue

**O problema:** Se um IP fizer 100 uploads simultâneos, o servidor pode travar.

**A solução:** `ProcessingQueue` mantém contagem de uploads simultâneos por IP.

```typescript
const queue = new ProcessingQueue(maxConcurrentPerIp: 3)
await queue.run(request.ip, async () => {
  // processar upload
})
```

- Se o IP já tem 3 uploads em andamento, retorna 429 (Too Many Requests).
- Quando o upload termina (sucesso ou erro), libera a vaga.

---

## 8. Segurança (Cada Medida Explicada)

### Upload Validation

- **Magic bytes `%PDF-`:** Primeiros 5 bytes do arquivo. Se não for `%PDF-`, rejeita. Nunca confia em extensão (.pdf) ou MIME type (application/pdf) — podem ser falsificados.
- **Limite de 20MB:** Protege contra uploads gigantes que esgotariam memória/disco.

### Nomes de Arquivo

- **UUID no filesystem:** O arquivo é salvo como `<uuid>.pdf`, não como `documento_original.pdf`. Isso impede:
  - Path traversal (`../../etc/passwd`).
  - PII (informações pessoais) no nome do arquivo.

### Rate Limiting

- **300 req/min por IP (padrão):** Impede abuso da API. O docker-compose sobrescreve para 100 em produção.
- **Helmet:** Headers de segurança HTTP (X-Content-Type-Options, X-Frame-Options, etc.).
- **CORS:** Whitelist de origens permitidas (padrão: `http://localhost:5173`).

### Trust Proxy

- **`trustProxy: 'loopback'`:** Confia em `X-Forwarded-*` apenas de proxies loopback (ex: nginx no Docker).
- Se fosse `true` (qualquer proxy), qualquer cliente poderia spoofear o IP e contornar rate limiting.

### PII nos Logs

- CPF, matrícula, e-mail são redigidos nos logs para evitar vazamento de dados pessoais.

### Retenção

- Transcrições expiram após 60 minutos (configurável).
- Cleanup timer remove do repositório E do disco.
- Timer usa `Math.min(retentionMs, 60_000)` — roda no máximo a cada 60s.

### Container

- Dockerfile roda como usuário não-root.
- Healthcheck via `wget` (não curl — menor ataque de superfície).

---

## 9. Estrutura de Testes (TDD)

### 9.1 Abordagem TDD

O projeto segue TDD (Test-Driven Development) para domain e application:

1. Escreve teste primeiro.
2. Roda teste (falha).
3. Implementa código mínimo para passar.
4. Refatora.

### 9.2 Estrutura

```
tests/
├── unit/
│   ├── domain/          ← Testes puros, sem mocks
│   │   ├── extractors.test.ts      ← Testa CartaoPontoExtractor e HoleriteExtractor
│   │   ├── shared/                 ← Testa date-utils, domain errors
│   │   ├── spreadsheet/            ← Testa SpreadsheetBuilder, HighlightDetector
│   │   └── transcription/          ← Testa entidades, value objects, services
│   └── application/     ← Testes com mocks nos ports
│       ├── create-transcription.test.ts
│       ├── process-transcription.test.ts
│       ├── get-transcription.test.ts
│       ├── update-transcription.test.ts
│       ├── export-spreadsheet.test.ts
│       └── result-parser.test.ts
├── integration/
│   ├── api.test.ts           ← Testa rotas HTTP (cria servidor Fastify real)
│   ├── pipeline.test.ts      ← Pipeline E2E com PDFs reais
│   └── upload-security.test.ts ← Testa validações de upload
└── fixtures/
    └── pdfs/                 ← PDFs sintéticos gerados para testes
```

### 9.3 Cobertura

- **Domain: ≥ 90%** (branches, functions, lines) — é o coração do projeto, precisa de cobertura alta.
- **Application: ≥ 80%** — use cases são orquestração, menos branches.

### 9.4 Diferença entre Unit e Integration

**Unit tests (domain):**

- Testam value objects, entidades, extratores isoladamente.
- Sem mocks, sem HTTP, sem banco.
- Ex: `Money.from("2.389,77")` deve retornar Money válido.

**Unit tests (application):**

- Testam use cases com mocks nos ports.
- Ex: `CreateTranscriptionUseCase` com `MockRepository` e `MockStorage`.

**Integration tests:**

- Testam o sistema real (HTTP + use cases + adapters).
- Ex: Fazer POST real, verificar response 202, fazer GET, verificar status.

---

## 10. Comandos Úteis

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

## 11. Fluxo de Dados Completo (Diagrama)

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

## 12. Arquivos Críticos para Referência

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

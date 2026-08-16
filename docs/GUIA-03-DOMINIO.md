# 3. Conceitos e Termos do Domínio

> [← Voltar ao índice](GUIA.md)

## 3.1 Documentos Trabalhistas Brasileiros

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

## 3.2 Value Objects — Por Que Existem

**Value Object** é um objeto que:

- Não tem identidade (dois Money com valor "1.000,00" são iguais)
- É imutável (uma vez criado, não muda)
- Valida suas próprias regras

**Por que não usar primitivos (string, number)?**

- Se `id` fosse `string`, qualquer string seria aceita como ID (inclusive path traversal).
- Com `TranscriptionId`, só UUIDs válidos são aceitos — a validação está no construtor.

## 3.3 Value Objects Detalhados

### `TranscriptionId` — Identificador Único

```typescript
const TRANSCRIPTION_ID_BRAND = Symbol('TranscriptionId')
// Branded type: impede que uma string qualquer seja usada como ID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

- **Branded type com Symbol:** Técnica TypeScript onde você adiciona uma propriedade única (Symbol) ao tipo. Isso impede que uma `string` qualquer seja atribuída a `TranscriptionId` — só IDs criados com `TranscriptionId.from()` são aceitos.
- **Validação UUID:** Impede path traversal (ex: `../../etc/passwd` como ID) e injeção em headers HTTP.

### `DocumentType` — Tipo de Documento

```typescript
export const DocumentType = {
  CARTAO_PONTO: 'cartao-ponto',
  HOLERITE: 'holerite',
} as const
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType]
```

- **Const object + type alias** (não `enum`): Em TypeScript, `enum` gera código JavaScript extra. `as const` + type alias é mais leve e tipado.
- **`as const`:** Diz ao TypeScript que os valores são literais (não `string` genérico).

### `TranscriptionStatus` — Máquina de Estados

```
PROCESSANDO → CONCLUIDO
PROCESSANDO → ERRO
```

- Transições válidas: só de `PROCESSANDO` para `CONCLUIDO` ou `ERRO`.
- Transições inválidas: `CONCLUIDO → ERRO` (lança erro), `ERRO → CONCLUIDO` (lança erro).
- A entidade NÃO é idempotente — chamar `complete()` duas vezes lança erro. A idempotência está no use case.

### `Punch` — Uma Batida de Ponto

```typescript
kind: 'IN' | 'OUT' // entrada ou saída
time_raw: '8:25' // como aparece no documento
time_hhmm: '08:25' // normalizado para HH:MM 24h
```

- **`time_raw` vs `time_hhmm`:** O documento pode ter "8:25" (sem zero à esquerda). `time_hhmm` normaliza para "08:25" para facilitar comparações.
- **`?` de incerteza:** Se o OCR não conseguiu ler um dígito, fica `?` (ex: "?8:25").

### `Money` — Valor Monetário

```typescript
// SEMPRE string no formato brasileiro — nunca float
Money.from('2.389,77') // válido
Money.from('2389.77') // ERRO — formato americano
Money.from(2389.77) // ERRO — não é string
Money.from('????') // válido — incerteza total
```

- **Por que string e não number?** Valores monetários com ponto flutuante causam erros de arredondamento (ex: `0.1 + 0.2 !== 0.3`). String preserva o formato exato do documento.
- **Incerteza:** `?` pode substituir qualquer dígito. `????` significa "não foi possível ler o valor".

### `DayRecord` — Um Dia no Cartão

```typescript
date_raw: '15/01/2024'    // data como aparece no documento
punches: [Punch, ...]     // batidas do dia
```

- **`isOddPunches()`:** Se tem número ímpar de batidas, falta entrada ou saída (warning).
- **`isDateNonSequential()`:** Se a data não é consecutiva à anterior, pode ser erro de leitura.

### `PageHolerite` — Uma Página de Holerite

```typescript
page: 1                    // número da página (1-indexed)
year: '2024'               // ano da competência
month: '01'                // mês da competência (01-12)
fields: PayrollField[]     // verbas da tabela principal
bases: PayrollBase[]       // bases de cálculo (seção separada)
```

- **`isEmpty()`:** Página existe no PDF mas nenhum dado saiu (warning).
- **`hasUncertainty()`:** Algum campo tem `?` (warning).

## 3.4 Entidade `Transcription` — O Aggregate Root

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

## 3.5 Ports — Contratos no Domain

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

## 3.6 Adapters — Implementações Concretas

| Adapter                           | Port que implementa        | O que faz                                                                                                               |
| --------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PdfJsExtractorAdapter`           | `PdfExtractorPort`         | Extrai texto de PDFs usando pdfjs-dist. Renderiza páginas como PNG para OCR. Usa `page.cleanup()` para liberar memória. |
| `TesseractOcrAdapter`             | `OcrEnginePort`            | OCR local com Tesseract.js. Worker é criado uma vez e reutilizado (warm start ~2s).                                     |
| `InMemoryTranscriptionRepository` | `TranscriptionRepository`  | Armazena transcrições em `Map<string, Transcription>`. Tem `deleteOlderThan()` para cleanup (NÃO está no port).         |
| `DiskFileStorage`                 | `FileStoragePort`          | Salva PDFs em disco com nome UUID (sem PII). Cria diretório automaticamente.                                            |
| `ExcelJsGeneratorAdapter`         | `SpreadsheetGeneratorPort` | Gera xlsx com formatação (cores, bordas), csv com BOM UTF-8, e json.                                                    |

---

> [← Arquitetura](GUIA-02-ARQUITETURA.md) | [Lógica de Negócio →](GUIA-04-LOGICA.md)

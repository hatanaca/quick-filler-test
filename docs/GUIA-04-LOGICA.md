# 4. Lógica de Negócio — Passo a Passo

> [← Voltar ao índice](GUIA.md)

## 4.1 O Fluxo Completo

### Etapa 1: Upload (POST /api/transcricoes)

```
Frontend → Fastify Route → CreateTranscriptionUseCase
```

**O que acontece no route (`transcricoes.route.ts`):**

1. `ProcessingQueue.run(request.ip, ...)` — Limita uploads simultâneos por IP (padrão: 3). Se exceder, retorna 429.
2. `verifyToken` preHandler — Valida JWT Bearer token no header `Authorization`. Se inválido ou ausente, retorna 401.
3. Lê o multipart/form-data: campo `arquivo` (PDF) e campo `tipo` ("cartao-ponto" ou "holerite").
4. Validações:
   - `isPdfMagicBytes(arquivo)` — Checa se os primeiros 5 bytes são `%PDF-` (nunca confia em extensão ou MIME).
   - `isUploadTooLarge(arquivo, maxBytes)` — Limite de 20MB.
   - `isDocumentType(tipo)` — Tipo válido.
5. Chama `CreateTranscriptionUseCase.execute(...)`.
6. Retorna `202 { id }` (Accepted — processamento é assíncrono).

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

### Etapa 2: Processamento (ProcessTranscriptionUseCase)

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

### Etapa 3: Polling (GET /api/transcricoes/:id)

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

### Etapa 4: Correções (PUT /api/transcricoes/:id)

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

### Etapa 5: Exportação (GET /api/transcricoes/:id/planilha)

**No backend:**

1. Busca transcrição. Se não é CONCLUIDO, lança erro.
2. `SpreadsheetBuilder.build(result, tipo)` — Constrói headers + rows.
3. `generator.generate(formato, headers, rows)` — Gera buffer no formato pedido.
4. Retorna arquivo com headers `Content-Type` e `Content-Disposition`.

---

## 4.2 Extração de Cartão de Ponto

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

---

## 4.3 Extração de Holerite

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

---

## 4.4 Regras de Incerteza (O Caractere `?`)

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

---

## 4.5 Sistema de Warnings (Derivados, Nunca Armazenados)

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

---

## 4.6 Construção da Planilha (SpreadsheetBuilder)

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

> [← Domínio](GUIA-03-DOMINIO.md) | [Decisões e Padrões →](GUIA-05-DECISOES.md)

# API HTTP (PT-BR / EN)

Contrato **literal e obrigatório** do desafio — divergir significa nota zero
em precisão. / Literal and **mandatory** challenge contract — diverging means
zero precision score.

## `POST /api/transcricoes`

`multipart/form-data` com dois campos / with two fields:

- `arquivo` — o PDF / the PDF
- `tipo` — `cartao-ponto` ou `holerite`

```http
HTTP/1.1 202 Accepted
{ "id": "abc123" }
```

Erros / Errors: `400` (sem arquivo, tipo inválido, não-PDF), `413` (acima do limite).

## `GET /api/transcricoes/:id`

```http
HTTP/1.1 200 OK
{
  "id": "abc123",
  "tipo": "cartao-ponto",
  "status": "concluido",
  "erro": null,
  "value": { "pages": [ ... ] }
}
```

`status` ∈ `processando` | `concluido` | `erro`. Enquanto `processando`,
`value` é `null`. Em `erro`, `erro` traz mensagem legível.
Not found → `404`.

## `PUT /api/transcricoes/:id`

Recebe / Receives `{ "value": { ... } }` com as correções da interface e
substitui a transcrição (somente quando `concluido`).
Value inválido (money float, mês 13, kind inválido) → `400`.

## `GET /api/transcricoes/:id/planilha`

Devolve a planilha com as correções aplicadas. / Returns the spreadsheet with
corrections applied.

`?formato=xlsx|csv|json` (padrão/ default: `xlsx`). Formato inválido → `400`.

## `GET /healthz`

```http
HTTP/1.1 200 OK
{"status":"ok"}
```

---

## Formatos de saída / Output formats

### Cartão de ponto / Time card

```jsonc
{
  "pages": [
    {
      "page": 1,
      "days": [
        {
          "date_raw": "21/05/2019",
          "punches": [
            { "kind": "IN",  "time_raw": "08:25", "time_hhmm": "08:25" },
            { "kind": "OUT", "time_raw": "18:25", "time_hhmm": "18:25" }
          ]
        },
        { "date_raw": "25/05/2019", "punches": [] }
      ]
    }
  ]
}
```

### Holerite / Pay stub

```jsonc
{
  "pages": [
    {
      "page": 1,
      "year": "2020",
      "month": "01",
      "fields": [
        { "code": "0010", "label": "Salário Base",     "reference": "220,00", "value": "2.389,77" }
      ],
      "bases": [
        { "label": "Base INSS",        "value": "2.545,68" },
        { "label": "Valor Líquido",     "value": "2.282,81" }
      ]
    }
  ]
}
```

Regras / Rules:

- Valores monetários são **string** no formato brasileiro (`"2.389,77"`), nunca float
- `_raw` preserva o documento; incerteza por caractere com `?` (`"2.3?9,77"`)
- `month` de `"01"` a `"12"` com zero à esquerda
- `label` sem o código; `code`/`reference` vazios quando ausentes
- `fields` = verbas da tabela principal; `bases` = seção separada (Base INSS,
  Valor Líquido etc.) — nunca confundir
- Ordem do documento preservada — nunca ordenar

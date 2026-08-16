# Documentos de exemplo

## PDFs presentes

| Arquivo              | Tipo         | Layout                             | Camada de texto |
| -------------------- | ------------ | ---------------------------------- | --------------- |
| `cartao-ponto-1.pdf` | cartao-ponto | padrão (sintético)                 | sim             |
| `time-card-01.pdf`   | cartao-ponto | FOLHA DE FREQUÊNCIA (SIPON)        | sim             |
| `time-card-02.pdf`   | cartao-ponto | Banco do Brasil — Ponto Eletrônico | não (OCR)       |
| `time-card-03.pdf`   | cartao-ponto | Cartão de Ponto (datas + colunas)  | não (OCR)       |
| `time-card-04.pdf`   | cartao-ponto | ilegível na digitalização          | não (OCR)       |
| `holerite-1.pdf`     | holerite     | padrão (sintético)                 | sim             |
| `payroll-01.pdf`     | holerite     | FICHA FINANCEIRA (multi-mês)       | sim             |
| `payroll-02.pdf`     | holerite     | Declaração Remuneração             | sim             |
| `payroll-03.pdf`     | holerite     | Demonstrativo de Pagamento         | sim             |
| `payroll-04.pdf`     | holerite     | Recibo de Pagamento                | não (OCR)       |

Os extratores detectam o layout por documento e despacham para o parser
específico (`packages/domain/src/transcription/extractors/`).

## Documentos escaneados (OCR)

`payroll-04`, `time-card-02/03/04` não têm camada de texto — o pipeline renderiza
cada página e roda Tesseract (`por`). A extração desses documentos é **melhor
esforço**: o OCR de tabelas é lossy, e a digitalização do `time-card-04` é
ilegível (a saída fica honestamente vazia em vez de inventar valores). O
`Recibo de Pagamento` (payroll-04) e o `Banco do Brasil` (time-card-02) têm
parsers dedicados que funcionam em digitalizações legíveis.

## Planilhas de entrega

```bash
npm run samples     # gera exemplos/output/ (xlsx, csv e json por documento)
```

Gera uma planilha por PDF em `exemplos/output/`:
`cartao-ponto-1`, `time-card-01..04`, `holerite-1`, `payroll-01..04`.

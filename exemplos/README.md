# Documentos de exemplo

Os PDFs oficiais do desafio (`cartao-ponto-1.pdf`, `cartao-ponto-2.pdf`,
`holerite-1.pdf`, `holerite-2.pdf`) **não estão disponíveis no repositório
público** — a pasta `exemplos/` do repositório do desafio contém apenas o
README.

## Como obter

Os PDFs são enviados pelo recrutador no início do processo. Coloque-os aqui:

```
exemplos/
├── cartao-ponto-1.pdf
├── cartao-ponto-2.pdf
├── holerite-1.pdf
└── holerite-2.pdf
```

## PDFs de teste sintéticos

Para desenvolvimento e CI sem depender dos PDFs oficiais, geramos PDFs
sintéticos com os mesmos layouts (cartão de ponto com batidas em pares,
holerite com tabela de verbas + seção de bases separada):

```bash
npm run test-pdfs   # gera tests/fixtures/pdfs/
```

## Planilhas de entrega

Com os PDFs oficiais em `exemplos/`, gere as planilhas (entregável do
desafio — xlsx, csv e json de cada documento) com:

```bash
npm run samples     # gera exemplos/output/
```

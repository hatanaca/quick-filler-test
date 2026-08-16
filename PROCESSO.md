# PROCESSO.md — Como conduzi o desafio

## Ferramentas usadas e para quê

| Ferramenta              | Uso                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| MiMoCode (agente CLI)   | Desenvolvimento assistido em todas as etapas: scaffolding, TDD, infraestrutura, Docker, documentação |
| Tesseract.js            | OCR dos documentos escaneados                                                                        |
| pdfjs-dist              | Extração de texto embutido e renderização de páginas                                                 |
| ExcelJS                 | Geração de planilhas xlsx com estilos (cabeçalho `#173772`, destaques)                               |
| Fastify + plugins       | API HTTP, helmet, CORS, rate limit, multipart, compress                                              |
| Vitest                  | Testes unitários (TDD), de integração e E2E                                                          |
| TypeScript strict       | Tipagem em toda a base                                                                               |
| ESLint + Prettier       | Padrão de código consistente                                                                         |
| Docker + docker-compose | Imagem multi-stage e orquestração                                                                    |

## Pontos em que o agente errou ou pegou o caminho errado

1. **Mensagens de erro sem o nome do campo.** Os testes exigiam que a
   mensagem de erro contivesse o nome do campo (`/value/`, `/id/`), mas o
   agente gerou mensagens genéricas ("Valor monetário em formato inválido").
   Percebi porque os testes falhavam com "expected to throw matching /value/".
   Corrigi as mensagens para incluir o campo e o motivo.
   → Lição: **o teste é a especificação**; a mensagem de erro também.

2. **Erro de indexação nos testes do WarningCalculator.** O agente escreveu
   testes assumindo `warnings[1]` (índice do array de avisos) como se fosse o
   índice do dia, mas o array só contém dias com aviso. Os testes falhavam
   com "undefined". Diagnostiquei rodando isolado e corrigi para
   `warnings.find(w => w.index === 1)`.
   → Lição: nunca assumir que índice do resultado = índice da entrada.

3. **Semântica invertida da "cadeia" de datas.** Inicialmente o agente
   interpretou "data ilegível não quebra a cadeia" como "a próxima data
   legível não é comparada com a anterior". Reli o enunciado:
   "páginas cuja competência não deu para ler não quebram a cadeia,
   comparam-se as próximas legíveis entre si" — ou seja, a próxima legível
   DEVE comparar com a anterior legível. Corrigi os testes e documentei a
   regra em ARCHITECTURE.md.
   → Lição: reler o enunciado literal antes de corrigir o código.

4. **Fastify v5: `logger` vs `loggerInstance`.** O agente passou uma
   instância pino em `logger` e o Fastify recusou ("logger options only
   accepts a configuration object"). Depois, ao usar `loggerInstance`, a
   inferência de tipos quebrou o generic do servidor. Solução: passar
   opções em `logger` com cast explícito.
   → Lição: verificar a versão da API (v5 mudou) em vez de assumir a v4.

5. **pdfjs v6 mudou a API** (`destroy` na loading task, `canvas` obrigatório
   no render) e havia **duas versões do pacote** no tree (4.8.69 do react-pdf
   vs 6.2.108 do backend) — o typecheck resolvia para a errada. Corrigi
   alinhando versões e adaptando o adapter.
   → Lição: `npm ls` antes de culpar o código.

## O que reescrevi à mão e por quê

- **WarningCalculator**: a lógica de cadeia (último legível) foi reescrita
  por mim após o erro #3, com os casos dez→jan e competência ilegível.
- **ReviewTable (frontend)**: a primeira versão gerada pelo agente tinha
  edição desconexa (mutava um clone descartado). Reescrevi com edição
  explícita célula → value → PUT.
- **Extractors**: refinei manualmente o regex do cartão (`?` no horário) e o
  parsing do holerite (value = último money, label sem código e sem `-`).

## Perguntas obrigatórias

### 1. Cite 3 decisões em que havia mais de uma resposta razoável. Por que escolheu essa?

1. **Tesseract local vs serviço de nuvem (Google Vision/AWS Textract).**
   Escolhi Tesseract: sem custo, sem API key (não há segredo no repo), roda
   offline no Docker e mantém o pipeline autocontido. O custo é precisão
   menor em digitalizações ruins — aceitei em troca de uma entrega que
   funciona sem credenciais.

2. **Polling (2s) vs SSE/WebSocket para o status.**
   O contrato tem um único endpoint de status e o processamento é curto;
   polling é trivial, funciona atrás de qualquer proxy e não mantém conexões.
   SSE exigiria mais infraestrutura sem ganho para o avaliador.

3. **Repositório em memória vs SQLite.**
   A retenção é curta (60min) e o fluxo inteiro vive dentro de um request
   ciclo; banco adiciona volume e configuração sem valor para a avaliação.
   Deixei a interface (port) pronta para trocar sem tocar no domínio.

### 2. O que na sua solução quebra primeiro em produção?

O **pool do Tesseract**: em produção, o worker é criado sob demanda na
primeira requisição (warm start ~2s) e há um limite de concorrência apenas
por documento (`OCR_WORKER_POOL_SIZE` como `concurrencyLimit` do
`ProcessTranscriptionUseCase`) — não existe um teto global de workers entre
transcrições simultâneas. Sob carga, vários workers simultâneos podem
estourar memória do container (imagem Alpine, ~300MB); a fila per-IP limita
o número de jobs por cliente, mas não o agregado.

### 3. Onde você não confia no que entregou?

- **Extratores em layouts desconhecidos**: funcionam bem nos PDFs sintéticos
  (tabelas simples, linhas regulares), mas holerites com layouts complexos
  (múltiplas seções, colunas mescladas, grid de horas) provavelmente
  misturam `fields` e `bases` ou perdem linhas — o teste E2E com os PDFs
  oficiais não pôde ser feito (não estão no repo público).
- **OCR**: a calibração dos `?` com Tesseract não foi validada contra
  digitalizações reais.
- **Frontend**: a tabela editável funciona, mas não tenho teste de UI
  automatizado (apenas manual via curl/Docker).

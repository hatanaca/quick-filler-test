# PROCESSO.md — Como conduzi o desafio

## Ferramentas usadas

O desenvolvimento foi feito com o MiMoCode (agente CLI), desde o scaffolding até testes, Docker e documentação. As demais ferramentas: Tesseract.js para OCR local, pdfjs-dist para extração de texto dos PDFs, ExcelJS para geração de planilhas, Fastify + TypeScript strict no backend, React + Vite no frontend.

Sobre o ZOD: o agente sugeriu para validação de schemas, e eu já tinha experiência com a lib. Pesquisando, vi que o ZOD tem mais impacto em cenários de alto volume de requisições — num projeto de processamento simples como este, o ganho não seria significativo. Optei por não usar.

## Supervisão do processo

Não escrevi trechos de código manualmente, mas acompanhei e vistoriei toda a construção. Minha atuação foi mais como revisor: verificando valores hardcoded, garantindo que middlewares de segurança fossem implementados, e orientando o agente quando ele tomava decisões inadequadas.

Um ponto recorrente era o agente centralizar código demais em arquivos centrais, criando sobrecarga. Havia duplicação de lógica entre use cases diferentes. Migrei esse código repetido para utils e ajustei o processo para manter a separação.

Também foi necessário pedir explicitamente para o agente adotar boas práticas de git — especialmente o .gitignore e o cuidado de não commitar arquivos sensíveis como uploads, .env e dados pessoais.

Durante os testes, percebi que a aplicação estava com baixa performance no processamento. A solução foi utilizar uma pool de workers para o OCR, com concorrência configurável — as páginas escaneadas são processadas em paralelo com limite de threads, evitando que o Tesseract estoure a memória.

## Perguntas obrigatórias

### 1. Cite 3 decisões em que havia mais de uma resposta razoável

**Tesseract local vs serviço de nuvem.** Poderia ter usado Google Vision ou AWS Textract, com melhor precisão. Escolhi Tesseract porque não tem custo, não precisa de API key e roda offline no Docker. A precisão é menor em digitalizações ruins, mas a entrega funciona sem credenciais externas.

**Banco em memória vs banco relacional.** A retenção é curta (60 minutos) e o fluxo inteiro vive dentro de um ciclo de request. Um banco adicionaria complexidade sem valor real para a avaliação. A interface (port) está pronta para trocar sem alterar o domínio.

**Polling vs SSE/WebSocket.** O contrato tem um único endpoint de status e o processamento é curto. Polling é simples, funciona atrás de qualquer proxy e não mantém conexões abertas.

### 2. O que na sua solução quebra primeiro em produção?

O pool do Tesseract. O worker é criado sob demanda na primeira requisição e há limite de concorrência por documento, mas não existe um teto global entre transcrições simultâneas. Sob carga, múltiplos workers podem estourar memória do container.

### 3. Onde você não confia no que entregou?

Nos extratores com layouts desconhecidos. Funcionam bem em PDFs com tabelas simples, mas holerites com layouts complexos provavelmente perdem linhas ou misturam campos. O teste E2E com os PDFs oficiais do desafio não pôde ser feito.

Também não validei a calibração do OCR contra digitalizações reais — os `?` funcionam no código, mas não testei com documentos escaneados de verdade.

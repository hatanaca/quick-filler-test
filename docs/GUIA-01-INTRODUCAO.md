# 1. Introdução e Stack

> [← Voltar ao índice](GUIA.md)

## 1.1 O Que é Este Projeto?

**Quick Filler** é uma aplicação web que resolve um problema real: transcrever documentos trabalhistas brasileiros (cartões de ponto e holerites) que estão em PDF para planilhas estruturadas.

**O problema:** Empresas brasileiras têm montanhas de documentos trabalhistas em PDF — cartões de ponto (registro diário de entrada/saída) e holerites (contracheques). Extrair dados desses PDFs manualmente é lento e sujeito a erros.

**A solução:** O usuário faz upload do PDF, a aplicação extrai os dados automaticamente (usando OCR se necessário), mostra uma tabela editável lado a lado com o PDF original, permite correções, e gera uma planilha limpa para download.

**É um desafio técnico** da empresa Quick Filler — não é um produto em produção, mas sim um projeto que demonstra competências em arquitetura de software, DDD, e resolução de problemas reais.

---

## 1.2 Por Que Esta Stack? (Cada Tecnologia Explicada)

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
- **CSV e JSON:** Geração nativa via ExcelJS (csv-stringify foi removido na v1.2.0).

### Vitest (testes)

- **Por que:** Test runner moderno, rápido, compatível com Vite. Suporta coverage com V8.
- **Alternativa considerada:** Jest — mais lento, configuração mais complexa com ESM.

### ESLint 9 + Prettier (qualidade)

- **ESLint:** Encontra bugs e problemas de código. Versão 9 com flat config (mais simples).
- **Prettier:** Formata código automaticamente (indent, aspas, etc.).
- **Husky + lint-staged:** Hooks do git que rodam lint e format automaticamente antes de cada commit.

---

> Próxima seção: [Arquitetura →](GUIA-02-ARQUITETURA.md)

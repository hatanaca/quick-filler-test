# Quick Filler — Guia Completo do Projeto

Este guia foi dividido em seções para facilitar a navegação. Cada seção cobre um aspecto específico do projeto.

## Índice

| Seção                 | Arquivo                                          | Conteúdo                                                         |
| --------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| 1. Introdução e Stack | [GUIA-01-INTRODUCAO.md](GUIA-01-INTRODUCAO.md)   | O que é o projeto, por que esta stack                            |
| 2. Arquitetura        | [GUIA-02-ARQUITETURA.md](GUIA-02-ARQUITETURA.md) | DDD + Hexagonal, monorepo, dependências, bounded contexts        |
| 3. Domínio            | [GUIA-03-DOMINIO.md](GUIA-03-DOMINIO.md)         | Value objects, entidade Transcription, ports, adapters           |
| 4. Lógica de Negócio  | [GUIA-04-LOGICA.md](GUIA-04-LOGICA.md)           | Fluxo completo, extração de cartão/holerite, warnings, planilha  |
| 5. Decisões e Padrões | [GUIA-05-DECISOES.md](GUIA-05-DECISOES.md)       | Decisões arquiteturais, padrões DDD, event bus, processing queue |
| 6. Segurança e Testes | [GUIA-06-SEGURANCA.md](GUIA-06-SEGURANCA.md)     | Upload validation, rate limiting, retenção, TDD, cobertura       |
| 7. Referência         | [GUIA-07-REFERENCIA.md](GUIA-07-REFERENCIA.md)   | Comandos úteis, fluxo de dados, arquivos críticos                |

## Visão Geral do Projeto

**Quick Filler** é uma aplicação web que transcreve documentos trabalhistas brasileiros (cartões de ponto e holerites) de PDF para planilhas estruturadas.

**Stack principal:**

- **Backend:** Node.js 22+, TypeScript strict, Fastify
- **Frontend:** React 18, Vite, TanStack React Query
- **OCR:** Tesseract.js (local)
- **PDF:** pdfjs-dist
- **Planilhas:** ExcelJS

**Arquitetura:** DDD + Hexagonal (Ports & Adapters) em monorepo com npm workspaces.

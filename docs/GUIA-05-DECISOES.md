# 5. Decisões Arquiteturais e Padrões Técnicos

> [← Voltar ao índice](GUIA.md)

## 5.1 Decisões Arquiteturais

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

### Autenticação JWT vs Session Store

- **JWT + httpOnly cookies:** Stateless, funciona atrás de qualquer proxy, refresh rotation. Access token curto (15min), refresh token longo em cookie httpOnly secure.
- **Session store (Redis/DB):** Mais controle sobre revogação, mas requer infraestrutura adicional e estado no servidor.
- **Decisão:** JWT porque o projeto já é stateless (repositório em memória) e funciona perfeitamente com um único processo. Logout revoga o refresh token.

---

## 5.2 Padrões e Conceitos Técnicos

### Domain-Driven Design (DDD)

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

### Hexagonal (Ports & Adapters)

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

### Use Cases (Application Layer)

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

### Event Bus

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

### Processing Queue

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

> [← Lógica de Negócio](GUIA-04-LOGICA.md) | [Segurança e Testes →](GUIA-06-SEGURANCA.md)

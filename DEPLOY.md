# Deploy para Produção - Quick Filler

## Arquitetura de Deploy

```
Internet → 200.158.242.69:5170 (Gateway SSL)
         → 192.168.15.83:5173 (nginx frontend)
         → backend:3001 (API)
```

- **Gateway**: Escuta na porta 5170, termina SSL, redireciona para 192.168.15.83:5173
- **nginx**: Frontend estático + proxy para API
- **Backend**: API Fastify

## Pré-requisitos

- Docker e Docker Compose instalados
- Gateway configurado na porta 5170 → 192.168.15.83:5173

## Passos para Deploy

### 1. Conectar ao servidor (192.168.15.83)

```bash
ssh usuario@192.168.15.83
```

### 2. Clonar ou atualizar o repositório

```bash
cd /opt
git clone <repo-url> quick-filler-test
cd quick-filler-test

# Se já existe:
git pull origin main
```

### 3. Configurar variáveis de ambiente

```bash
# Copiar o exemplo
cp .env.example .env

# Editar com valores reais
nano .env
```

**Configurações importantes para produção:**

```bash
# IP público (gateway)
DOMAIN=200.158.242.69

# CORS deve usar HTTPS (via gateway)
CORS_ORIGIN=https://200.158.242.69

# API URL deve usar HTTPS (via gateway)
VITE_API_URL=https://200.158.242.69/filler/api

# Gerar secret forte para JWT
JWT_SECRET=$(openssl rand -base64 32)

# Credenciais de produção (REQUIRED)
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=$(openssl rand -base64 24)
USER_EMAIL=user@seudominio.com
USER_PASSWORD=$(openssl rand -base64 24)
```

### 4. Construir e iniciar os containers

```bash
docker compose build
docker compose up -d
```

### 5. Verificar status

```bash
# Verificar containers
docker compose ps

# Verificar logs
docker compose logs -f backend

# Testar health check (localmente)
curl http://localhost:5173/healthz

# Testar via gateway
curl -k https://200.158.242.69/healthz
```

### 6. Verificar porta 5173

```bash
# Verificar se nginx está escutando na porta 5173
netstat -tlnp | grep 5173
# ou
ss -tlnp | grep 5173
```

## Comandos Úteis

```bash
# Parar containers
docker compose down

# Reconstruir após mudanças
docker compose build --no-cache
docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Reiniciar backend
docker compose restart backend
```

## Credenciais

As credenciais são configuradas via variáveis de ambiente no `.env`:

```bash
# Gerar senhas fortes: openssl rand -base64 24
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=<senha-forte>
USER_EMAIL=user@seudominio.com
USER_PASSWORD=<senha-forte>
```

> **Importante:** Nunca commite senhas no repositório. Use variáveis de ambiente ou um secret manager.

## Troubleshooting

### Gateway não acessível

1. Verificar se o gateway está escutando na porta 5170
2. Verificar se o gateway está redirecionando para 192.168.15.83:5173
3. Verificar firewall do servidor

### Backend não inicia

1. Verificar se JWT_SECRET está definido no .env
2. Verificar logs: `docker compose logs backend`
3. Verificar se o volume uploads existe: `docker volume ls`

### CORS erro

1. Verificar CORS_ORIGIN no .env (deve ser HTTPS)
2. Verificar se o gateway está passando os headers corretos

### Porta 5173 não está acessível

1. Verificar se o container frontend está rodando
2. Verificar se o mapeamento de porta está correto: `docker compose ps`
3. Verificar se o gateway está configurado corretamente

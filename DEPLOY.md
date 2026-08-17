# Deploy para Produção - Quick Filler

## Pré-requisitos

- Docker e Docker Compose instalados
- Acesso ao servidor via SSH
- Certificados Let's Encrypt (ou gerar novos)

## Passos para Deploy

### 1. Conectar ao servidor

```bash
ssh usuario@200.158.244.244
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
# Usar IP público ou domínio
DOMAIN=200.158.244.244

# CORS deve usar HTTPS
CORS_ORIGIN=https://200.158.244.244

# API URL deve usar HTTPS
VITE_API_URL=https://200.158.244.244/filler/api

# Gerar secret forte para JWT
JWT_SECRET=$(openssl rand -base64 32)
```

### 4. Inicializar certificados SSL (primeira vez)

```bash
./scripts/init-letsencrypt.sh 200.158.244.244 admin@seudominio.com
```

### 5. Construir e iniciar os containers

```bash
docker compose build
docker compose up -d
```

### 6. Verificar status

```bash
# Verificar containers
docker compose ps

# Verificar logs
docker compose logs -f backend

# Testar health check
curl -k https://200.158.244.244/healthz
```

### 7. Verificar HTTPS

```bash
# Testar SSL
curl -I https://200.158.244.244

# Deve retornar:
# HTTP/2 200
# strict-transport-security: max-age=63072000; includeSubDomains
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

# Backup do banco (se usar banco externo)
# docker compose exec backend <comando-backup>
```

## Credenciais de Teste

- **Admin:** admin@quickfiller.com / admin123
- **Usuário:** user@quickfiller.com / user123

## Troubleshooting

### SSL não funciona

1. Verificar se as portas 80 e 443 estão abertas no firewall
2. Verificar se o DNS aponta para o servidor
3. Verificar logs do nginx: `docker compose logs frontend`

### Backend não inicia

1. Verificar se JWT_SECRET está definido
2. Verificar logs: `docker compose logs backend`
3. Verificar se o volume uploads existe: `docker volume ls`

### CORS erro

1. Verificar CORS_ORIGIN no .env (deve ser HTTPS)
2. Verificar se o frontend está servindo na porta correta

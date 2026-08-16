# ============================================
# Stage 1: build
# ============================================
FROM node:26-alpine AS build

WORKDIR /app

# npm >= 11 (npm 10.9.x falha ao executar o lifecycle `prepare` do husky)
RUN npm install -g npm@11

# Dependências primeiro (aproveita cache do Docker)
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/application/package.json packages/application/
COPY packages/infrastructure/package.json packages/infrastructure/
COPY packages/frontend/package.json packages/frontend/
RUN npm ci

# Código-fonte
COPY tsconfig.base.json eslint.config.js vitest.config.ts ./
COPY packages packages

# Build dos pacotes
RUN npm run build

# ============================================
# Stage 2: produção (backend)
# ============================================
FROM node:26-alpine AS backend

WORKDIR /app
ENV NODE_ENV=production

# npm >= 11 (npm 10.9.x falha ao executar o lifecycle `prepare` do husky)
RUN npm install -g npm@11

# Dependências de produção dos pacotes
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/application/package.json packages/application/
COPY packages/infrastructure/package.json packages/infrastructure/
RUN npm ci --omit=dev --workspace=@quickfiller/domain --workspace=@quickfiller/application --workspace=@quickfiller/infrastructure

# Builds já compilados (stage 1)
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/application/dist packages/application/dist
COPY --from=build /app/packages/infrastructure/dist packages/infrastructure/dist

# Não rodar como root (segurança)
RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /app/uploads && chown -R app:app /app
USER app

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3001/healthz || exit 1

CMD ["node", "packages/infrastructure/dist/bootstrap.js"]

# ============================================
# Stage 3: frontend estático (servido por nginx)
# ============================================
FROM nginx:1.27-alpine AS frontend

COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

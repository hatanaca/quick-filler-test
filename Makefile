.PHONY: setup install dev build test test-unit test-integration test-frontend test-e2e lint typecheck format format-check docker-up docker-down clean

# Setup inicial
setup:
	cp -n .env.example .env || true
	npm install

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm test

# Alvos com hífen: "test:unit:" como nome de alvo era parseado como static
# pattern rule e derrubava o Makefile inteiro (nenhum alvo funcionava).
test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

test-frontend:
	npm run test:frontend

test-e2e:
	npm run test:e2e

lint:
	npm run lint

typecheck:
	npm run typecheck

format:
	npm run format

format-check:
	npm run format:check

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

clean:
	rm -rf node_modules packages/*/node_modules packages/*/dist

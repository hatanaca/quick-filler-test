.PHONY: setup install dev build test lint typecheck format docker-up docker-down clean

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

test:unit:
	npm run test:unit

test:integration:
	npm run test:integration

lint:
	npm run lint

typecheck:
	npm run typecheck

format:
	npm run format

format:check:
	npm run format:check

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

clean:
	rm -rf node_modules packages/*/node_modules packages/*/dist

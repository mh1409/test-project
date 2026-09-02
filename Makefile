.DEFAULT_GOAL := help
SHELL := /bin/bash

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

setup: ## Install deps, start infra, migrate and seed
	pnpm install
	cp -n .env.example .env || true
	docker compose up -d postgres redis opensearch rabbitmq minio minio-init mailpit jaeger
	pnpm db:generate
	pnpm db:migrate
	pnpm db:seed

infra-up: ## Start infrastructure containers only
	docker compose up -d postgres redis opensearch rabbitmq minio minio-init mailpit jaeger

infra-down: ## Stop infrastructure containers
	docker compose down

app-up: ## Build and run the full stack in Docker
	docker compose --profile app up -d --build

dev: ## Run all apps in dev mode
	pnpm dev

migrate: ## Apply migrations
	pnpm db:migrate

migrate-dev: ## Create a new migration from schema changes
	pnpm db:migrate:dev

seed: ## Seed demo data
	pnpm db:seed

seed-large: ## Seed large deterministic dataset
	pnpm db:seed:large

reset-db: ## Drop, recreate, migrate and seed database
	pnpm db:reset && pnpm db:migrate && pnpm db:seed

lint: ## Lint all packages
	pnpm lint

typecheck: ## Type check all packages
	pnpm typecheck

test: ## Run unit + integration tests
	pnpm test

test-e2e: ## Run Playwright E2E tests
	pnpm test:e2e

build: ## Build everything
	pnpm build

check: ## Full validation (format, lint, typecheck, tests, build)
	pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build

reindex: ## Rebuild search indexes
	pnpm search:reindex

load-test: ## Run k6 smoke load tests (requires k6)
	k6 run infra/k6/homepage.js && k6 run infra/k6/search.js && k6 run infra/k6/product.js && k6 run infra/k6/checkout.js

.PHONY: help setup infra-up infra-down app-up dev migrate migrate-dev seed seed-large reset-db lint typecheck test test-e2e build check reindex load-test

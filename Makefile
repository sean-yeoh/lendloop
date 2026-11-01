# Development commands. Run `make` or `make help` for the list.

# Podman if it is installed, otherwise Docker. Override with `make COMPOSE="docker compose" ...`.
COMPOSE ?= $(shell command -v podman >/dev/null 2>&1 && echo "podman compose" || echo "docker compose")

# Optional machine-specific settings, not committed. For example: MAILPIT_HOST_PORT = 8026
-include Makefile.local

# Host ports for the containers. Override if a port is taken: make container-up MAILPIT_HOST_PORT=8026
export N8N_HOST_PORT ?= 5678
export MAILPIT_HOST_PORT ?= 8025

.DEFAULT_GOAL := help
.PHONY: help install dev container-up container-down container-logs seed test check admin-grant admin-revoke

help: ## Show this list
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-16s %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install

dev: container-up ## Start n8n and Mailpit, then Next.js and Convex together
	hivemind Procfile.dev

container-up: ## Start n8n and Mailpit in the background
	$(COMPOSE) up -d

container-down: ## Stop n8n and Mailpit (data volumes are kept)
	$(COMPOSE) down

container-logs: ## Follow the n8n and Mailpit logs
	$(COMPOSE) logs -f

seed: ## Create the test users, tools, and loans (convex dev must run)
	pnpm seed

test: ## Run the tests once
	pnpm test:once

check: ## Type-check, lint, and test
	pnpm exec tsc --noEmit
	pnpm lint
	pnpm test:once

admin-grant: ## Give admin rights: make admin-grant EMAIL=you@example.com
	@test -n "$(EMAIL)" || (echo "Usage: make admin-grant EMAIL=you@example.com" && exit 1)
	pnpm admin:grant $(EMAIL)

admin-revoke: ## Remove admin rights: make admin-revoke EMAIL=you@example.com
	@test -n "$(EMAIL)" || (echo "Usage: make admin-revoke EMAIL=you@example.com" && exit 1)
	pnpm admin:revoke $(EMAIL)

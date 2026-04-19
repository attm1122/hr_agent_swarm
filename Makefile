# HR Agent Swarm - Makefile
# Quick commands for common tasks

.PHONY: help install dev build test lint clean setup deploy

# Default target
help:
	@echo "HR Agent Swarm - Available Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install     - Install dependencies"
	@echo "  make setup       - Run automated setup"
	@echo "  make setup-admin - Create admin user"
	@echo ""
	@echo "Development:"
	@echo "  make dev         - Start development server"
	@echo "  make build       - Build for production"
	@echo "  make typecheck   - Run TypeScript checks"
	@echo ""
	@echo "Testing:"
	@echo "  make test        - Run tests"
	@echo "  make test-watch  - Run tests in watch mode"
	@echo "  make verify      - Verify Supabase connection"
	@echo ""
	@echo "Database:"
	@echo "  make db-push     - Apply migrations"
	@echo "  make db-reset    - Reset with seed data"
	@echo "  make db-status   - Check migration status"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy      - Deploy to Vercel preview"
	@echo "  make deploy-prod - Deploy to production"
	@echo "  make health      - Check app health"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make lint        - Run linter"
	@echo "  make lint-fix    - Fix linting issues"

# Setup
install:
	npm ci

setup:
	npx tsx scripts/setup.ts

setup-admin:
	npx tsx scripts/setup-admin.ts

# Development
dev:
	npm run dev

build:
	npm run build

typecheck:
	npm run typecheck

# Testing
test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

verify:
	npx tsx scripts/verify-supabase.ts

# Database
db-push:
	npx supabase db push

db-reset:
	npx supabase db reset

db-status:
	npx supabase db status

db-link:
	npx supabase link --project-ref ycrvhfgcdygdjqzlglgt

# Deployment
deploy:
	npx tsx scripts/deploy.ts preview

deploy-prod:
	npx tsx scripts/deploy.ts production

health:
	npx tsx scripts/health-check.ts

# Maintenance
clean:
	rm -rf .next
	rm -rf node_modules
	rm -rf coverage

lint:
	npm run lint

lint-fix:
	npm run lint:fix

# Quick start
start: install setup
	@echo "Setup complete! Run 'make dev' to start."

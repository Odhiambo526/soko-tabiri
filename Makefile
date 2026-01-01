# Soko Tabiri - Makefile
# Privacy-Preserving Prediction Markets on Zcash

.PHONY: help dev-up dev-down dev-logs test lint clean build migrate verify

# Default target
help:
	@echo "Soko Tabiri - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev-up        Start all services (docker-compose up --build)"
	@echo "  make dev-down      Stop all services"
	@echo "  make dev-logs      Tail logs from all services"
	@echo "  make dev-monitoring Start with Prometheus/Grafana"
	@echo ""
	@echo "Testing:"
	@echo "  make test          Run all tests"
	@echo "  make test-unit     Run unit tests only"
	@echo "  make test-int      Run integration tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint          Run linters"
	@echo "  make format        Format code"
	@echo "  make verify        Run pre-push verification (lint, test, secrets, AI review bundle)"
	@echo ""
	@echo "Database:"
	@echo "  make migrate       Run database migrations"
	@echo "  make migrate-down  Rollback last migration"
	@echo ""
	@echo "Build:"
	@echo "  make build         Build all Docker images"
	@echo "  make clean         Remove containers, volumes, and build artifacts"

# =============================================================================
# DEVELOPMENT
# =============================================================================

dev-up:
	@echo "Starting Soko Tabiri services..."
	docker-compose -f docker-compose.yml up --build -d
	@echo ""
	@echo "Services starting. Health check endpoints:"
	@echo "  Gateway:    http://localhost:3001/health"
	@echo "  Engine:     http://localhost:3002/health"
	@echo "  Settlement: http://localhost:3003/health"
	@echo "  Oracle:     http://localhost:3004/health"
	@echo ""
	@echo "Run 'make dev-logs' to see logs"

dev-down:
	@echo "Stopping Soko Tabiri services..."
	docker-compose -f docker-compose.yml down

dev-logs:
	docker-compose -f docker-compose.yml logs -f

dev-monitoring:
	@echo "Starting with monitoring stack (Prometheus + Grafana)..."
	docker-compose -f docker-compose.yml --profile monitoring up --build -d
	@echo ""
	@echo "Monitoring endpoints:"
	@echo "  Prometheus: http://localhost:9090"
	@echo "  Grafana:    http://localhost:3000 (admin/admin)"

dev-frontend:
	@echo "Starting with frontend..."
	docker-compose -f docker-compose.yml --profile frontend up --build -d
	@echo ""
	@echo "Frontend: http://localhost:5173"

# =============================================================================
# TESTING
# =============================================================================

test: test-unit test-int
	@echo "All tests completed"

test-unit:
	@echo "Running unit tests..."
	cd services/engine && npm test
	cd services/settlement && npm test
	cd services/oracle && npm test

test-int:
	@echo "Running integration tests..."
	@echo "Starting services in test mode..."
	MOCK_LIGHTWALLETD=true docker-compose -f docker-compose.yml up --build -d
	@sleep 10
	@echo "Running smoke tests..."
	cd services/gateway-api && npm run test:integration
	@echo "Stopping test services..."
	docker-compose -f docker-compose.yml down

# =============================================================================
# CODE QUALITY
# =============================================================================

lint:
	@echo "Running linters..."
	cd services/gateway-api && npm run lint
	cd services/engine && npm run lint
	cd services/settlement && npm run lint
	cd services/oracle && npm run lint
	@echo "Lint completed"

format:
	@echo "Formatting code..."
	cd services/gateway-api && npm run format
	cd services/engine && npm run format
	cd services/settlement && npm run format
	cd services/oracle && npm run format

verify:
	@echo "Running pre-push verification..."
	./scripts/prepush-verify.sh

install-hooks:
	@echo "Installing git hooks..."
	cp scripts/pre-push.hook .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
	@echo "Pre-push hook installed."

# =============================================================================
# DATABASE
# =============================================================================

migrate:
	@echo "Running database migrations..."
	docker-compose -f docker-compose.yml exec postgres psql -U soko -d soko_tabiri -f /docker-entrypoint-initdb.d/001_init.sql

migrate-status:
	@echo "Checking migration status..."
	docker-compose -f docker-compose.yml exec postgres psql -U soko -d soko_tabiri -c "SELECT * FROM schema_migrations ORDER BY version;"

# =============================================================================
# BUILD
# =============================================================================

build:
	@echo "Building all Docker images..."
	docker-compose -f docker-compose.yml build

clean:
	@echo "Cleaning up..."
	docker-compose -f docker-compose.yml down -v --remove-orphans
	docker system prune -f
	rm -rf services/*/node_modules
	rm -rf services/*/dist
	@echo "Cleanup completed"

# =============================================================================
# INDIVIDUAL SERVICES
# =============================================================================

gateway:
	cd services/gateway-api && npm run dev

engine:
	cd services/engine && npm run dev

settlement:
	cd services/settlement && npm run dev

oracle:
	cd services/oracle && npm run dev


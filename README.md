# eSales - NestJS Microservices

A microservices-based system built with NestJS, PostgreSQL, and Prisma ORM.

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | System diagram, services, communication patterns, tech stack |
| [API Reference](docs/api-reference.md) | HTTP endpoints, request/response examples, DTOs |
| [Database](docs/database.md) | Prisma schemas, migrations, database-per-service pattern |
| [Deployment](docs/deployment.md) | Docker profiles, infrastructure, monitoring, env vars, troubleshooting |

## Tech Stack

| Component | Technology |
|---|---|
| Backend Framework | NestJS 11 + TypeScript |
| Database | PostgreSQL 17 |
| ORM | Prisma 7.8 |
| Auth | JWT + Passport.js + bcrypt |
| Transport | TCP (default) / Kafka (via `KAFKA_BROKER`) |
| Cache | Redis (via `REDIS_URL`) / in-memory fallback |
| Payments | Stripe / stub mode (via `STRIPE_STUB=true`) |
| Notifications | Mailpit (via `SMTP_HOST`) / Gmail OAuth2 |
| Observability | Prometheus `/metrics`, Terminus `/health/*`, Swagger `/api/docs` |
| Security | helmet, CORS, rate limiting (@nestjs/throttler) |
| Runtime | Node.js 22 (Alpine) |
| Package Manager | pnpm 9.x |
| Container | Docker Compose (profiles: core / infra / monitoring) |

## Quick Start

**Prerequisites:** [Docker](https://www.docker.com/) and [pnpm](https://pnpm.io/) 9.x, Node.js 22+

### 1. Set up environment files

```bash
# Docker env (uses Docker hostnames: postgres, kafka, redis, mailpit)
cp apps/reservations/.env.example apps/reservations/.env
cp apps/auth/.env.example apps/auth/.env
cp apps/payments/.env.example apps/payments/.env
cp apps/notifications/.env.example apps/notifications/.env

# Local dev env (uses localhost with exposed ports)
cp apps/reservations/.env.example apps/reservations/.env.local
cp apps/auth/.env.example apps/auth/.env.local
cp apps/payments/.env.example apps/payments/.env.local
cp apps/notifications/.env.example apps/notifications/.env.local
```

Then edit `.env.local` files: replace Docker hostnames with `localhost` and ports with exposed host ports (5433, 9093, 6380, 1025). See `.env.local` files already created for reference.

### 2. Start infrastructure (Docker)

```bash
# Core only — PostgreSQL
docker compose up -d postgres

# Full infra — Redis, Kafka, Elasticsearch, MinIO, Mailpit
docker compose --profile infra up -d

# Full infra + monitoring — adds Prometheus, Grafana, Loki
docker compose --profile infra --profile monitoring up -d
```

### 3. Run services locally (with hot-reload)

```bash
# Kill any orphaned nest processes first (avoids port conflicts)
pkill -f 'nest start' || true

# All 4 services in one terminal (colored output per service)
pnpm dev

# Or individually
pnpm dev:auth
pnpm dev:reservations
pnpm dev:payments
pnpm dev:notifications
```

Each `dev:*` script reads from `apps/<service>/.env.local` automatically.

> **Without Kafka/Redis:** Remove `KAFKA_BROKER` and `REDIS_URL` from `.env.local` to run with TCP transport and in-memory cache.

### 4. Verify

```bash
curl http://localhost:4000/health/live   # Reservations
curl http://localhost:4001/health/live   # Auth
```

| Service | URL |
|---|---|
| Reservations Swagger | http://localhost:4000/api/docs |
| Auth Swagger | http://localhost:4001/api/docs |
| Mailpit (email inbox) | http://localhost:8025 |
| Kafka UI | http://localhost:8080 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3100 (admin/admin) |
| MinIO Console | http://localhost:9001 (minioadmin/minioadmin123) |

## Run Tests

```bash
# Full end-to-end flow (26 tests)
./scripts/test-api.sh

# Unit tests (@app/common — 27 tests)
npx jest --roots '<rootDir>/libs/' --verbose
```

The test script validates: health checks, Prometheus metrics, Swagger, user registration, JWT auth, reservations CRUD, stub payment via Kafka, email delivery via Mailpit, role-based access, and Kafka topic creation.

## Or: Run Everything in Docker

```bash
# Start all services in Docker (no local Node.js needed)
docker compose --profile infra --profile monitoring up -d
```

Docker services run in **development mode** with hot-reload — code changes auto-reload without rebuilding. Only rebuild when needed:

| Change | Action |
|---|---|
| Code changes (`.ts` files) | Nothing — auto-reloads via `nest start --watch` |
| New npm dependency (`pnpm add`) | `docker compose up -d --build <service>` |
| Dockerfile changes | `docker compose up -d --build <service>` |
| `.env` changes | `docker compose up -d <service>` (recreates container) |

> **Note:** Docker services use Docker hostnames (`postgres`, `kafka`, `redis`, `mailpit`), not `localhost`. The `.env` files are already configured for this. When testing from your host machine (e.g. `./scripts/test-api.sh`), use `localhost` with the exposed ports (4000, 4001, etc.).

## Environment

Each service has its own `.env` file — copy from `.env.example` to get started. See [Deployment docs](docs/deployment.md#environment-variables) for all variables.

Key optional variables:

| Variable | Effect |
|---|---|
| `KAFKA_BROKER=kafka:9092` | Switch transport from TCP to Kafka |
| `REDIS_URL=redis://redis:6379` | Switch cache from in-memory to Redis |
| `STRIPE_STUB=true` | Fake payments, no Stripe key needed |
| `SMTP_HOST=mailpit` | Send emails to Mailpit instead of Gmail |

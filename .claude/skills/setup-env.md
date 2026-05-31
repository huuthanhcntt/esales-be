---
name: setup-env
description: Set up and manage the eSales development environment — Docker infra + local services with hot-reload, env files, and troubleshooting.
user_invocable: true
---

# Setup eSales Environment

Help the user set up, start, stop, or troubleshoot the eSales development environment.

## Step 1 — Show options and ask user what they need

Display this to the user:

---

**eSales Environment Setup**

| # | Action | Description |
|---|--------|-------------|
| 1 | **First-time setup** | Create env files, start infra, run migrations, start services |
| 2 | **Start (local dev)** | Start infra (Docker) + app services locally with hot-reload |
| 3 | **Start (Docker only)** | Start everything in Docker containers |
| 4 | **Stop** | Stop services and/or infra |
| 5 | **Reset** | Stop, remove volumes, start fresh |
| 6 | **Status** | Show what's running, health checks, port usage |
| 7 | **Fix issues** | Diagnose and fix common problems |

What would you like to do?

---

Wait for the user to respond before proceeding.

## Step 2 — Execute the selected action

### Prerequisites check (run for all actions except stop/status)

```bash
docker info --format '{{.Name}}' 2>&1
```

If Docker is not running, tell the user to start Docker Desktop or Rancher Desktop first.

### Action 1: First-time setup

```bash
# 1. Create env files from examples (all 7 services)
for svc in reservations auth payments notifications products orders media; do
  cp apps/$svc/.env.example apps/$svc/.env 2>/dev/null || true
  cp apps/$svc/.env.local.example apps/$svc/.env.local 2>/dev/null || true
done

# 2. Install dependencies
pnpm install

# 3. Start infra only (postgres, redis, kafka, minio, mailpit)
docker compose --profile infra up -d

# 4. Wait for postgres
until docker inspect --format='{{.State.Health.Status}}' esales-postgres-1 2>/dev/null | grep -q "healthy"; do sleep 3; done

# 5. Create databases for new services (if not exist)
docker exec esales-postgres-1 psql -U postgres -c "CREATE DATABASE products;" 2>/dev/null || true
docker exec esales-postgres-1 psql -U postgres -c "CREATE DATABASE orders;" 2>/dev/null || true

# 6. Run Prisma migrations (all DB services)
for svc in reservations auth products orders; do
  cd apps/$svc && npx dotenv-cli -e .env.local -- pnpm prisma migrate deploy && cd ../..
done

# 7. Generate Prisma clients
for svc in reservations auth products orders; do
  cd apps/$svc && npx dotenv-cli -e .env.local -- pnpm prisma generate && cd ../..
done

# 8. Start all 7 services locally with hot-reload
pnpm dev
```

Wait for all services to show "Nest application successfully started", then verify:
```bash
curl http://localhost:4000/health/live   # Reservations
curl http://localhost:4001/health/live   # Auth
curl http://localhost:3005/health/live   # Products
curl http://localhost:3007/health/live   # Orders
curl http://localhost:3009/health/live   # Media
curl http://localhost:3013/health/live   # Payments
curl http://localhost:3014/health/live   # Notifications
```

### Action 2: Start (local dev) — recommended

This is the recommended dev workflow: Docker for infra, local Node.js for app services (with hot-reload).

```bash
# Kill any orphaned processes from previous sessions
pkill -f 'nest start' || true

# Start infra (postgres, kafka, redis, mailpit, elasticsearch, minio)
docker compose --profile infra up -d

# Start all 7 app services locally with hot-reload
pnpm dev
```

To start with monitoring dashboards too:
```bash
docker compose --profile infra --profile monitoring up -d
pnpm dev
```

To start individual services:
```bash
pnpm dev:auth
pnpm dev:reservations
pnpm dev:payments
pnpm dev:notifications
pnpm dev:products
pnpm dev:orders
pnpm dev:media
```

### Action 3: Start (Docker only)

Runs everything in Docker containers. Code changes require container restart (hot-reload doesn't work reliably on macOS Docker due to file system event propagation).

```bash
# Core + infra
docker compose --profile infra up -d

# Or everything including monitoring
docker compose --profile infra --profile monitoring up -d
```

Only rebuild when source code or dependencies change:
```bash
docker compose up -d --build reservations auth payments notifications
```

### Action 4: Stop

```bash
# Stop app services (local)
pkill -f 'nest start' || true

# Stop Docker infra
docker compose --profile infra --profile monitoring down

# Or stop specific containers
docker compose stop kafka redis mailpit
```

### Action 5: Reset

Confirm with user before proceeding — this deletes all data (database, Kafka topics, Redis cache).

```bash
pkill -f 'nest start' || true
docker compose --profile infra --profile monitoring down -v
docker compose --profile infra up -d

# Wait for postgres, re-run migrations
until docker inspect --format='{{.State.Health.Status}}' esales-postgres-1 2>/dev/null | grep -q "healthy"; do sleep 3; done
cd apps/reservations && dotenv -e .env.local -- pnpm prisma migrate deploy && cd ../..
cd apps/auth && dotenv -e .env.local -- pnpm prisma migrate deploy && cd ../..

pnpm dev
```

### Action 6: Status

```bash
# Docker containers
docker compose --profile infra --profile monitoring ps

# Check for local node processes on app ports
lsof -i :4000 -i :4001 -i :3005 -i :3007 -i :3009 -i :3013 -i :3014 2>/dev/null | grep node || echo "No local services running"

# Health checks (all 7 services)
curl -s http://localhost:4000/health/live 2>/dev/null || echo "Reservations: not responding"
curl -s http://localhost:4001/health/live 2>/dev/null || echo "Auth: not responding"
curl -s http://localhost:3005/health/live 2>/dev/null || echo "Products: not responding"
curl -s http://localhost:3007/health/live 2>/dev/null || echo "Orders: not responding"
curl -s http://localhost:3009/health/live 2>/dev/null || echo "Media: not responding"
curl -s http://localhost:3013/health/live 2>/dev/null || echo "Payments: not responding"
curl -s http://localhost:3014/health/live 2>/dev/null || echo "Notifications: not responding"

# Kafka consumer groups
docker exec esales-kafka-1 kafka-consumer-groups --bootstrap-server kafka:9092 --list 2>/dev/null || echo "Kafka: not running"
```

### Action 7: Fix issues

Run diagnostics:

```bash
# Check container status
docker compose --profile infra ps

# Check for port conflicts (local processes shadowing Docker)
for port in 4000 4001 3003 3004; do
  PID=$(lsof -ti :$port 2>/dev/null | head -1)
  [ -n "$PID" ] && echo "Port $port: PID $PID — $(ps -p $PID -o command= 2>/dev/null)"
done

# Check logs for errors
docker compose logs --tail 20 reservations auth payments notifications 2>/dev/null
```

**Common issues and fixes:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| Auth works but reservations returns 403 | Orphaned local node processes shadowing Docker ports | `pkill -f 'nest start'` then restart |
| `P1001: Can't reach database server` | Stale Docker network or postgres not healthy | `docker compose down && docker compose --profile infra up -d` |
| `Port already allocated` | Host port conflict (e.g. Redis 6379) | Check `lsof -i :<port>`, ports remapped: Redis=6380, Kafka=9093 |
| Containers keep restarting | Prisma migration or Node version issue | Check logs, ensure `node:22-alpine` in Dockerfile |
| Kafka connection errors | Consumer group rebalancing after restart | Wait 30s for consumers to stabilize, or restart service |
| Hot-reload not working in Docker | macOS file system events don't propagate to containers | Use `pnpm dev` (local) instead of Docker for app services |
| `ERR_PNPM_IGNORED_BUILDS` | Wrong pnpm version in Dockerfile | Ensure Dockerfile has `npm install -g pnpm@9.15.4` |

## Service Reference

### App Services (run locally via `pnpm dev`)

| Service | HTTP Port | TCP Port | Swagger | Env File (local) |
|---------|-----------|----------|---------|-------------------|
| Reservations | 4000 | — | http://localhost:4000/api/docs | `apps/reservations/.env.local` |
| Auth | 4001 | 3002 | http://localhost:4001/api/docs | `apps/auth/.env.local` |
| Products | 3005 | 3006 | http://localhost:3005/api/docs | `apps/products/.env.local` |
| Orders | 3007 | 3008 | http://localhost:3007/api/docs | `apps/orders/.env.local` |
| Media | 3009 | 3010 | http://localhost:3009/api/docs | `apps/media/.env.local` |
| Payments | 3013 | 3003 | http://localhost:3013/api/docs | `apps/payments/.env.local` |
| Notifications | 3014 | 3004 | http://localhost:3014/api/docs | `apps/notifications/.env.local` |

### Infrastructure (Docker, `--profile infra`)

| Service | Container | Host Port | Dashboard |
|---------|-----------|-----------|-----------|
| PostgreSQL | esales-postgres-1 | 5433 | `psql -h localhost -p 5433 -U postgres` |
| Redis | esales-redis-1 | 6380 | `redis-cli -p 6380` |
| Kafka | esales-kafka-1 | 9093 (external) | http://localhost:8080 (Kafka UI) |
| Elasticsearch | esales-elasticsearch-1 | 9200 | http://localhost:9200/_cluster/health |
| Mailpit | esales-mailpit-1 | 8025 (UI), 1025 (SMTP) | http://localhost:8025 |
| MinIO | esales-minio-1 | 9000 (API), 9001 (Console) | http://localhost:9001 (minioadmin/minioadmin123) |
| Zookeeper | esales-zookeeper-1 | 2181 | — |
| Kafka UI | esales-kafka-ui-1 | 8080 | http://localhost:8080 |

### Monitoring (Docker, `--profile monitoring`)

| Service | Container | Host Port | Credentials |
|---------|-----------|-----------|-------------|
| Prometheus | esales-prometheus-1 | 9090 | http://localhost:9090/targets |
| Grafana | esales-grafana-1 | 3100 | http://localhost:3100 (admin/admin) |
| Loki | esales-loki-1 | 3101 | — |

## Environment Files

| File | Purpose | Hostnames |
|------|---------|-----------|
| `apps/<service>/.env` | Docker containers | `postgres`, `kafka`, `redis`, `mailpit` |
| `apps/<service>/.env.local` | Local dev (`pnpm dev`) | `localhost` with exposed ports (5433, 9093, 6380, 1025) |
| `apps/<service>/.env.example` | Template for `.env` (Docker) | Committed to git |
| `apps/<service>/.env.local.example` | Template for `.env.local` (local) | Committed to git |

### Key optional variables

| Variable | Effect | Local value | Docker value |
|----------|--------|-------------|-------------|
| `KAFKA_BROKER` | TCP → Kafka transport | `localhost:9093` | `kafka:9092` |
| `REDIS_URL` | In-memory → Redis cache | `redis://localhost:6380` | `redis://redis:6379` |
| `STRIPE_STUB=true` | Skip real Stripe API | Same | Same |
| `SMTP_HOST` | Gmail → Mailpit email | `localhost` | `mailpit` |

Remove `KAFKA_BROKER` and `REDIS_URL` to run with TCP transport and in-memory cache (simplest setup, no Kafka/Redis needed).
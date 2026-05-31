# Deployment & Configuration

## Docker Compose Profiles

The infrastructure is organized into profiles to keep the core stack lightweight:

```bash
# Core only (default) - 5 containers
docker compose up -d

# Core + infrastructure (Redis, Kafka, Elasticsearch, MinIO) - 12 containers
docker compose --profile infra up -d

# Core + monitoring (Prometheus, Grafana, Loki) - 8 containers
docker compose --profile monitoring up -d

# Everything - 15 containers
docker compose --profile infra --profile monitoring up -d
```

---

## Core Services (default)

| Container | Service | Host Port → Internal | Description |
|---|---|---|---|
| `esales-postgres-1` | PostgreSQL 17 | `5433 → 5432` | Database with auto-created per-service schemas |
| `esales-reservations-1` | Reservations API | `4000 → 3000` | HTTP REST API for reservations |
| `esales-auth-1` | Auth Service | `4001 → 3001` (HTTP), `3002` (TCP) | JWT auth + user management |
| `esales-products-1` | Products Service | `4005 → 3005` (HTTP), `3006` (TCP) | Product catalog + categories + WebSocket |
| `esales-orders-1` | Orders Service | `4007 → 3007` (HTTP), `3008` (TCP) | Order lifecycle + checkout |
| `esales-media-1` | Media Service | `4009 → 3009` (HTTP), `3010` (TCP) | File upload via MinIO/S3 |
| `esales-payments-1` | Payments Service | `3013` (HTTP), `3003` (TCP) | Stripe payment processing |
| `esales-notifications-1` | Notifications Service | `3014` (HTTP), `3004` (TCP) | Email notifications |

All app services mount the project root as a volume for hot-reloading during development.

---

## Infrastructure Services (profile: `infra`)

| Service | Image | Ports | Purpose |
|---|---|---|---|
| Redis | `redis:7.4` | `6380 → 6379` | Cache & session store |
| Elasticsearch | `elasticsearch:8.17.0` | `9200` | Full-text search |
| Zookeeper | `cp-zookeeper:7.9.0` | `2181` | Kafka coordination |
| Kafka | `cp-kafka:7.9.0` | `9093 → 9093` (host), `9092` (internal) | Event-driven messaging |
| Kafka UI | `kafbat/kafka-ui:v1.5.0` | `8080` | Kafka management dashboard |
| MinIO | `minio:RELEASE.2025-09-07` | `9000`, `9001` | S3-compatible object storage |
| Mailpit | `axllent/mailpit:v1.24` | `8025` (UI), `1025` (SMTP) | Local email capture |

### How Infrastructure Connects to the Application

These services are **not wired into the application by default**. They activate when you set the corresponding environment variables:

| Service | Activates When | What It Does |
|---|---|---|
| **Redis** | `REDIS_URL=redis://redis:6379` set on reservations/auth | `RedisCacheModule` switches from in-memory to Redis-backed cache. Used for caching user lookups, reservation queries, and future session/token storage. |
| **Kafka** | `KAFKA_BROKER=kafka:9092` set on any service | `createServiceClient()` and `createMicroserviceOptions()` switch inter-service communication from TCP to Kafka topics. Messages like `create_charge` and `notify_email` flow through Kafka instead of direct TCP. |
| **Mailpit** | `SMTP_HOST=mailpit` set on notifications | Notifications service sends emails via plain SMTP to Mailpit instead of Gmail OAuth. All emails are captured and viewable at http://localhost:8025. |
| **Stripe Stub** | `STRIPE_STUB=true` set on payments | Payments service returns fake PaymentIntents without calling Stripe API. No `STRIPE_SECRET_KEY` needed. |
| **Elasticsearch** | Not yet wired | Future: full-text search for reservations, audit log indexing. Will be integrated when search endpoints are added. |
| **MinIO** | `MINIO_ENDPOINT=minio` set on media | Media service uploads/downloads files from MinIO buckets. Console at http://localhost:9001. |

### Verifying Infrastructure Services

**Redis:**
```bash
# Connect via CLI
docker exec -it esales-redis-1 redis-cli

# Check it's working
127.0.0.1:6379> PING
PONG

# See cached keys (if REDIS_URL is set on app services)
127.0.0.1:6379> KEYS *

# Monitor commands in real-time
127.0.0.1:6379> MONITOR
```

**Elasticsearch:**
```bash
# Cluster health
curl http://localhost:9200/_cluster/health?pretty

# List indices
curl http://localhost:9200/_cat/indices?v

# Check node info
curl http://localhost:9200/_nodes/stats?pretty
```

**Kafka:**
```bash
# Open Kafka UI in browser
open http://localhost:8080

# Or via CLI — list topics (use internal port inside container)
docker exec -it esales-kafka-1 kafka-topics --bootstrap-server kafka:9092 --list

# Describe a topic
docker exec -it esales-kafka-1 kafka-topics --bootstrap-server kafka:9092 --describe --topic <topic-name>

# Watch messages on a topic in real-time
docker exec -it esales-kafka-1 kafka-console-consumer --bootstrap-server kafka:9092 --topic <topic-name> --from-beginning
```

> **Kafka ports:** Internal `kafka:9092` (container-to-container), External `localhost:9093` (host access).

**MinIO:**
```bash
# Open MinIO Console in browser
open http://localhost:9001
# Login: minioadmin / minioadmin123

# Or via CLI (install mc first: brew install minio/stable/mc)
mc alias set local http://localhost:9000 minioadmin minioadmin123
mc ls local/
mc mb local/esales-uploads   # create a bucket
```

**Mailpit (local email):**
```bash
# Open inbox in browser
open http://localhost:8025

# Check messages via API
curl -s http://localhost:8025/api/v1/messages | python3 -m json.tool

# Send a test email directly
curl -s --url 'smtp://localhost:1025' \
  --mail-from 'test@esales.local' --mail-rcpt 'user@example.com' \
  -T - <<< "Subject: Test
This is a test email."
```

---

## Monitoring Services (profile: `monitoring`)

| Service | Image | Ports | Purpose |
|---|---|---|---|
| Prometheus | `prometheus:v3.12.0` | `9090` | Metrics collection |
| Grafana | `grafana:11.6.0` | `3100` | Dashboards (admin/admin) |
| Loki | `loki:3.4.0` | `3101` | Log aggregation |

### How Monitoring Connects to the Application

Every service exposes a `GET /metrics` endpoint (via `MetricsModule`). Prometheus scrapes these endpoints on a schedule and stores time-series data. Grafana reads from Prometheus and Loki to visualize metrics and logs.

```
┌──────────────┐    GET /metrics     ┌────────────┐     query     ┌─────────┐
│ Reservations │ ◄────────────────── │ Prometheus │ ◄──────────── │ Grafana │
│ Auth         │    every 10s        │  :9090     │               │  :3100  │
│ Payments     │                     └────────────┘               │         │
│ Notifications│                                                  │         │
└──────────────┘                     ┌────────────┐               │         │
                                     │   Loki     │ ◄──────────── │         │
       container logs ──────────────►│  :3101     │    query      └─────────┘
                                     └────────────┘
```

**What gets collected automatically:**
- HTTP request count, duration (P50/P95/P99), status codes
- Node.js process metrics (CPU, memory, event loop lag, GC)
- Active handles and requests

### Prometheus Configuration

Scrape targets configured in `monitoring/prometheus/prometheus.yml`:

| Target | Endpoint | Interval |
|---|---|---|
| Reservations | `reservations:3000/metrics` | 10s |
| Auth | `auth:3001/metrics` | 10s |
| Payments | `payments:3013/metrics` | 10s |
| Notifications | `notifications:3014/metrics` | 10s |
| PostgreSQL | `postgres:5432` | 15s |
| Redis | `redis:6379` | 15s |
| Elasticsearch | `elasticsearch:9200` | 15s |
| Kafka | `kafka:9092` | 15s |

### Verifying Monitoring

**Prometheus** — http://localhost:9090
```bash
# Check all scrape targets and their status
open http://localhost:9090/targets

# Try a PromQL query in the UI:
#   rate(http_requests_total[5m])                    — request rate
#   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))  — P95 latency
#   process_resident_memory_bytes                    — memory usage per service
#   up                                               — which targets are reachable
```

**Grafana** — http://localhost:3100
```
Login: admin / admin

Pre-configured datasources:
  - Prometheus (default) → for metrics queries
  - Loki → for log queries

To explore metrics:
  1. Go to Explore (compass icon in sidebar)
  2. Select "Prometheus" datasource
  3. Try: rate(http_requests_total[5m])

To explore logs:
  1. Go to Explore
  2. Select "Loki" datasource
  3. Try: {container="esales-reservations-1"}
```

**Loki** — log aggregation
```bash
# Query logs via API
curl -s "http://localhost:3101/loki/api/v1/labels" | python3 -m json.tool

# Search logs for a specific service (use Grafana Explore for a better UI)
curl -s 'http://localhost:3101/loki/api/v1/query_range' \
  --data-urlencode 'query={container="esales-auth-1"}' | python3 -m json.tool
```

### Grafana

- **URL:** `http://localhost:3100`
- **Default credentials:** `admin` / `admin`
- **Datasources:** Prometheus (default) + Loki (logs)
- **Dashboards:** File-based provisioning from `monitoring/grafana/provisioning/dashboards/`

---

## Multi-Stage Dockerfile

Each service uses a multi-stage build pinned to **Node.js 22 Alpine**:

```dockerfile
# Stage 1: Development
FROM node:22-alpine AS development
# Install pnpm@9.15.4, copy package files, install deps, copy source, build

# Stage 2: Production
FROM node:22-alpine AS production
ENV NODE_ENV=production
# Install pnpm@9.15.4, install prod deps only, copy dist from dev stage
```

For services with Prisma (auth, reservations, products, orders):
```bash
CMD pnpm prisma migrate deploy && node dist/apps/<service>/main
```

For services without Prisma (payments, notifications, media):
```bash
CMD ["node", "dist/apps/<service>/main"]
```

> **Note:** Dockerfiles are pinned to `node:22-alpine` (not `node:alpine`) because Node.js 26+ breaks Prisma's `proper-lockfile` dependency.

---

## Database Initialization

The `scripts/init-db.sh` script runs on first PostgreSQL container startup:

```bash
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE auth;
    CREATE DATABASE reservations;
    CREATE DATABASE payments;
    CREATE DATABASE notifications;
    CREATE DATABASE products;
    CREATE DATABASE orders;
EOSQL
```

This implements the **database-per-service** pattern — each microservice has its own isolated database within a single PostgreSQL instance.

---

## Common Commands

```bash
# Start / stop
docker compose up -d
docker compose down

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f                    # all services
docker compose logs -f reservations auth  # specific services

# Connect to PostgreSQL
docker exec -it esales-postgres-1 psql -U postgres -d auth
docker exec -it esales-postgres-1 psql -U postgres -d reservations

# Clean restart (reset database)
docker compose down -v
docker compose up -d

# Shell into a service
docker exec -it esales-auth-1 sh
```

---

## Troubleshooting

### Services restarting in a loop

Check logs: `docker compose logs auth --tail 20`

Common causes:
- **`P1001: Can't reach database server`** — Stale Docker network. Fix: `docker compose down && docker compose up -d`
- **Port already allocated** — Another process is using the port. Check with `lsof -i :<port>` and stop the conflicting process, or change the port mapping in `docker-compose.yaml`

### pnpm build script errors in Docker

The Dockerfiles pin `pnpm@9.15.4` to avoid pnpm 10's build script approval requirement. If you see `ERR_PNPM_IGNORED_BUILDS`, ensure the Dockerfile uses `npm install -g pnpm@9.15.4` (not unversioned `pnpm`).

---

## Observability & API Docs Endpoints

All services expose these endpoints for infrastructure tooling:

| Endpoint | Description | Used By |
|---|---|---|
| `GET /metrics` | Prometheus metrics (request counts, latency histograms, Node.js stats) | Prometheus scraper |
| `GET /health/live` | Liveness probe — returns 200 if process is running | Kubernetes liveness probe |
| `GET /health/ready` | Readiness probe — returns 200 if service is ready | Kubernetes readiness probe |
| `GET /health` | Backward-compatible health check | General monitoring |

All 7 services expose Swagger UI:

| Service | Swagger URL |
|---|---|
| Auth | http://localhost:4001/api/docs |
| Reservations | http://localhost:4000/api/docs |
| Products | http://localhost:3005/api/docs |
| Orders | http://localhost:3007/api/docs |
| Media | http://localhost:3009/api/docs |
| Payments | http://localhost:3013/api/docs |
| Notifications | http://localhost:3014/api/docs |

---

## Optional Environment Variables

These environment variables enable optional infrastructure features. When not set, the service falls back to simpler alternatives:

| Variable | Used By | Description | Fallback |
|---|---|---|---|
| `KAFKA_BROKER` | All services | Kafka broker address (e.g. `kafka:9092`). Switches transport from TCP to Kafka. | TCP transport |
| `REDIS_URL` | Reservations, Auth | Redis connection URL (e.g. `redis://redis:6379`). Enables Redis cache. | In-memory cache |
| `SMTP_HOST` | Notifications | SMTP server hostname (e.g. `mailpit`). Uses plain SMTP instead of Gmail OAuth. | Gmail OAuth2 |
| `SMTP_PORT` | Notifications | SMTP server port. | `1025` |
| `STRIPE_STUB` | Payments | Set to `true` to return fake PaymentIntents. No Stripe key needed. | Real Stripe API |

> **Port note:** Redis host port is `6380` (not default 6379) to avoid conflicts with local Redis or SSH tunnels.

---

## Environment Variables

Each service has its own `.env` file in `apps/<service>/.env`.

### Reservations (`apps/reservations/.env`)

| Variable       | Type   | Example                                          | Description                |
| -------------- | ------ | ------------------------------------------------ | -------------------------- |
| `DATABASE_URL` | string | `postgresql://postgres:postgres@postgres:5432/reservations` | PostgreSQL connection string |
| `PORT`         | number | `3000`                                           | HTTP server port           |
| `AUTH_HOST`    | string | `auth`                                           | Auth service hostname      |
| `AUTH_PORT`    | number | `3002`                                           | Auth service TCP port      |
| `PAYMENTS_HOST`| string | `payments`                                       | Payments service hostname  |
| `PAYMENTS_PORT`| number | `3003`                                           | Payments service TCP port  |

### Auth (`apps/auth/.env`)

| Variable         | Type   | Example                                     | Description                |
| ---------------- | ------ | ------------------------------------------- | -------------------------- |
| `DATABASE_URL`   | string | `postgresql://postgres:postgres@postgres:5432/auth` | PostgreSQL connection string |
| `JWT_SECRET`     | string | `<long-random-string>`                      | JWT signing secret         |
| `JWT_EXPIRATION` | number | `3600`                                      | JWT expiry in seconds      |
| `HTTP_PORT`      | number | `3001`                                      | HTTP server port           |
| `TCP_PORT`       | number | `3002`                                      | TCP microservice port      |

### Payments (`apps/payments/.env`)

| Variable              | Type   | Example          | Description                   |
| --------------------- | ------ | ---------------- | ----------------------------- |
| `PORT`                | number | `3003`           | TCP microservice port         |
| `NOTIFICATIONS_HOST`  | string | `notifications`  | Notifications service hostname|
| `NOTIFICATIONS_PORT`  | number | `3004`           | Notifications service TCP port|
| `STRIPE_STUB`         | string | `true`           | Stub mode — no real Stripe calls |
| `STRIPE_SECRET_KEY`   | string | `sk_test_...`    | Stripe API key (not needed if `STRIPE_STUB=true`) |

### Notifications (`apps/notifications/.env`)

**Option A: Local development (Mailpit)**

| Variable    | Type   | Example    | Description         |
| ----------- | ------ | ---------- | ------------------- |
| `PORT`      | number | `3004`     | TCP microservice port |
| `SMTP_HOST` | string | `mailpit`  | SMTP server hostname |
| `SMTP_PORT` | number | `1025`     | SMTP server port     |

**Option B: Production (Gmail OAuth2)**

| Variable                      | Type   | Example                       | Description                |
| ----------------------------- | ------ | ----------------------------- | -------------------------- |
| `PORT`                        | number | `3004`                        | TCP microservice port      |
| `SMTP_USER`                   | string | `noreply@esales.com`          | Gmail sender address       |
| `GOOGLE_OAUTH_CLIENT_ID`     | string | `474561...`                   | Google OAuth client ID     |
| `GOOGLE_OAUTH_CLIENT_SECRET` | string | `GOCSPX-...`                  | Google OAuth client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | string | `1//04...`                    | Google OAuth refresh token |

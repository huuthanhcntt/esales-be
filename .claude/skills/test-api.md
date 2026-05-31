---
name: test-api
description: Run the eSales API test suite — full flow with auth, reservations, stub payments, Mailpit email verification, Kafka topics, health checks, and Prometheus metrics.
user_invocable: true
---

# Test eSales APIs

Before running tests, present the available test flows to the user and ask which ones to run.

## Step 1 — Show available test flows and ask user to confirm

Display this to the user:

---

**eSales API Test Flows**

| # | Flow | What it tests |
|---|------|---------------|
| 1 | Health & Readiness | `/health/live`, `/health/ready` on all HTTP services |
| 2 | Prometheus Metrics | `/metrics` returns process_cpu_seconds_total, http_request_duration_seconds |
| 3 | Swagger / OpenAPI | `/api/docs` accessible on reservations (4000) and auth (4001) |
| 4 | User Registration | Create user, create admin, reject weak password, reject invalid email |
| 5 | Authentication | Login valid/invalid credentials, extract JWT, verify cookie |
| 6 | User Profile | Get current user with JWT, reject unauthenticated |
| 7 | Reservations CRUD + Payment + Email | Create reservation → stub payment → email sent → verify in Mailpit |
| 8 | Email Verification (Mailpit) | Check Mailpit inbox for payment notification email |
| 9 | Role-Based Access | Non-admin DELETE blocked (403), admin DELETE succeeds |
| 10 | Kafka Topics | List Kafka topics created by the services |
| all | Full E2E suite | All of the above in sequence (26 tests) |
| unit | Unit tests | Run @app/common unit tests (27 tests) |
| coverage | Unit tests + coverage | Run unit tests and show coverage report |

**Notes:**
- Flows 5-9 depend on flow 4 (need a user first)
- Payments uses **stub mode** (`STRIPE_STUB=true`) — no real Stripe charges
- Emails go to **Mailpit** (`SMTP_HOST=mailpit`) — view at http://localhost:8025
- Stripe test card: `4242424242424242` (used in stub response, no real validation)

Which flows would you like to run? (e.g. "all", "1,2,3", "just health checks", "full flow")

---

Wait for the user to respond before proceeding.

## Step 2 — Verify services are running

### 2a. Check infrastructure (Docker)

```bash
docker compose --profile infra --profile monitoring ps
```

Check that these infra containers are running: postgres, mailpit, kafka, redis.

If not running:
```bash
docker compose --profile infra --profile monitoring up -d
```

### 2b. Check app services (local or Docker)

App services (reservations, auth, payments, notifications) can run either locally via `pnpm dev` or as Docker containers. Check both:

```bash
# Check if services respond on their ports
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health/live
curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/health/live
```

```bash
# Check if local node processes are holding the ports
lsof -i :4000 -i :4001 -t 2>/dev/null | head -5
```

If services are not responding on ports 4000/4001, start them:
```bash
# Kill any orphaned nest processes first
pkill -f 'nest start' || true

# Start all services locally
pnpm dev
```

Wait for services to be healthy (look for "Nest application successfully started" in the output).

## Step 3 — Run the selected tests

### Option A: Run full E2E suite
If user chose **all** or **full flow**:
```bash
./scripts/test-api.sh
```

### Option B: Run specific E2E flows
If user chose specific flows (e.g. "1,2,3"), run the relevant curl commands manually using the Endpoint Reference below.

### Option C: Run unit tests
If user chose **unit**:
```bash
npx jest --roots '<rootDir>/libs/' --verbose
```

This runs 27 unit tests across 4 suites:
- **JwtAuthGuard** (9 tests) — JWT extraction, role checks, auth errors
- **Transport helper** (7 tests) — TCP/Kafka switching for client and server
- **HealthController** (3 tests) — liveness, readiness, root endpoints
- **DTOs** (8 tests) — CardDto and CreateChargeDto validation rules

### Option D: Run unit tests with coverage
If user chose **coverage**:
```bash
npx jest --roots '<rootDir>/libs/' --coverage --verbose
```

After running, present the coverage table to the user. The target is **>= 80% line coverage** (per NOVA_TechStack NFR).

Show results like:

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| jwt-auth.guard.ts | XX% | XX% | XX% | XX% |
| transport.helper.ts | XX% | XX% | XX% | XX% |
| health.controller.ts | XX% | XX% | XX% | XX% |
| card.dto.ts | XX% | XX% | XX% | XX% |
| create-charge.dto.ts | XX% | XX% | XX% | XX% |
| **Total** | **XX%** | **XX%** | **XX%** | **XX%** |

Flag any file below 80% line coverage.

> **Note:** Coverage collection may fail on Node.js 22+ due to a `lru-cache`/`path-scurry` dependency issue. If it fails, the tests themselves still pass — only the coverage instrumentation is affected.

## Step 4 — Report results

After the test script finishes, present a **results summary** to the user:

### 4a. Test Results Table

Parse the script output and show:

| Section | Tests | Status |
|---------|-------|--------|
| Health Checks | 4 | all passed / X failed |
| Prometheus Metrics | 2 | ... |
| Swagger / OpenAPI | 2 | ... |
| User Registration | 4 | ... |
| Authentication | 3 | ... |
| Authenticated User | 2 | ... |
| Reservations CRUD + Payment + Email | 5 | ... |
| Email Verification (Mailpit) | 1 | ... |
| Role-Based Access | 2 | ... |
| **Total** | **26** | **X passed, Y failed** |

For any failures: show the endpoint, expected vs actual status code, and response body.

### 4b. Mailpit Inbox

Check Mailpit for captured emails:
```bash
curl -s http://localhost:8025/api/v1/messages | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Inbox: {data['total']} email(s)\")
for m in data.get('messages', []):
    print(f\"  From: {m['From']['Address']}\")
    print(f\"  To:   {m['To'][0]['Address']}\")
    print(f\"  Subject: {m['Subject']}\")
    print()
"
```

Tell the user they can view emails at: http://localhost:8025

### 4c. Kafka Dashboard

Check Kafka topics and consumer groups:
```bash
# Topics
docker exec esales-kafka-1 kafka-topics --bootstrap-server kafka:9092 --list

# Consumer groups and their lag
docker exec esales-kafka-1 kafka-consumer-groups --bootstrap-server kafka:9092 --list
```

For each consumer group, check lag:
```bash
docker exec esales-kafka-1 kafka-consumer-groups --bootstrap-server kafka:9092 --describe --group <group-name>
```

Present the results as:

**Kafka Topics:**
| Topic | Description |
|-------|-------------|
| `authenticate` | JWT validation requests (reservations → auth) |
| `authenticate.reply` | JWT validation responses (auth → reservations) |
| `create_charge` | Payment requests (reservations → payments) |
| `create_charge.reply` | Payment responses (payments → reservations) |
| `notify_email` | Email notification events (payments → notifications) |

**Consumer Groups:**
| Group | Topic | Lag | Status |
|-------|-------|-----|--------|
| `auth-server-group-server` | `authenticate` | 0 | Healthy |
| `auth-consumer-client` | `authenticate.reply` | 0 | Healthy |
| ... | ... | ... | ... |

A lag of 0 means all messages are consumed. Lag > 0 means messages are queued.

Tell the user they can view Kafka UI at: http://localhost:8080

### 4d. Quick Links

After results, show:

| Dashboard | URL |
|-----------|-----|
| Mailpit (emails) | http://localhost:8025 |
| Kafka UI | http://localhost:8080 |
| Swagger (Reservations) | http://localhost:4000/api/docs |
| Swagger (Auth) | http://localhost:4001/api/docs |
| Prometheus | http://localhost:9090/targets |
| Grafana | http://localhost:3100 |

## Troubleshooting

### All auth-protected endpoints return 403

**Symptom:** Health checks pass but authenticated requests to reservations fail with 403.

**Cause:** Orphaned local node processes holding ports 4000/4001, shadowing Docker containers.

**Fix:**
```bash
pkill -f "nest start"
docker compose restart reservations auth
```

The test script will warn about this automatically if detected.

### Kafka consumer lag keeps growing

**Symptom:** Consumer group lag > 0 and not decreasing.

**Fix:** Restart the affected service:
```bash
docker compose restart <service-name>
```

## Endpoint Reference

### Auth Service (host port 4001)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| `GET` | `/health/live` | No | - | Liveness probe |
| `GET` | `/health/ready` | No | - | Readiness probe |
| `GET` | `/metrics` | No | - | Prometheus metrics |
| `GET` | `/api/docs` | No | - | Swagger UI |
| `POST` | `/users` | No | `{email, password, roles?}` | Create user (strong password required) |
| `GET` | `/users` | JWT | - | Get current authenticated user |
| `POST` | `/auth/login` | No | `{email, password}` | Login, returns JWT in `Set-Cookie: Authentication=<token>` |

### Reservations Service (host port 4000)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| `GET` | `/health/live` | No | - | Liveness probe |
| `GET` | `/health/ready` | No | - | Readiness probe |
| `GET` | `/metrics` | No | - | Prometheus metrics |
| `GET` | `/api/docs` | No | - | Swagger UI |
| `POST` | `/reservations` | JWT | `{startDate, endDate, charge: {card, amount}}` | Create reservation → triggers payment + email |
| `GET` | `/reservations` | JWT | - | List all reservations |
| `GET` | `/reservations/:id` | JWT | - | Get reservation by ID |
| `PATCH` | `/reservations/:id` | JWT | `{startDate?, endDate?}` | Update reservation |
| `DELETE` | `/reservations/:id` | JWT + Admin | - | Delete reservation (Admin only) |

### Mailpit (port 8025)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/messages` | List all captured emails |
| `DELETE` | `/api/v1/messages` | Clear inbox |

Web UI: http://localhost:8025

### Kafka

```bash
# List topics from inside container
docker exec esales-kafka-1 kafka-topics --bootstrap-server kafka:9092 --list
```

### Test Data

**Test card (stub mode — no real validation):**
```json
{
  "number": "4242424242424242",
  "exp_month": 12,
  "exp_year": 2030,
  "cvc": "123"
}
```

**Test user:**
```json
{
  "email": "test@esales.com",
  "password": "Test1234!@"
}
```

## Infrastructure Modes

| Feature | Env Var | Dev Default | What Happens |
|---------|---------|-------------|--------------|
| Payments | `STRIPE_STUB=true` | Stub enabled | Returns fake PaymentIntent, no Stripe key needed |
| Email | `SMTP_HOST=mailpit` | Mailpit enabled | Emails captured at http://localhost:8025 |
| Transport | `KAFKA_BROKER=kafka:9092` | Kafka enabled | Services communicate via Kafka instead of TCP |
| Cache | `REDIS_URL=redis://redis:6379` | Redis enabled | Reservations + Auth use Redis cache |

To switch to real Stripe/Gmail, update `apps/<service>/.env` — see `.env.example` for options.
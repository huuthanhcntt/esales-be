---
name: test-api
description: Run the eSales API test suite — per-service tests, full E2E flow, health checks, Prometheus metrics, and Kafka topics across all 7 microservices.
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
| 1 | Health & Readiness | `/health/live`, `/health/ready` on all 7 services |
| 2 | Prometheus Metrics | `/metrics` on all 7 services |
| 3 | Swagger / OpenAPI | `/api/docs` accessible on all 7 services |

**Per-Service Tests:**

| # | Service | What it tests |
|---|---------|---------------|
| 4 | Auth | Register user, login, JWT cookie, get profile, strong password validation |
| 5 | Reservations | CRUD + payment integration + email notification |
| 6 | Products | CRUD, categories, pagination, search, owner-only update/delete |
| 7 | Orders | Create order, stock validation, checkout + payment, cancel, admin list |
| 8 | Media | Upload file, get signed URL, delete file |

**Cross-Service Flows:**

| # | Flow | What it tests |
|---|------|---------------|
| 9 | E2E Reservation flow | Register -> Login -> Create reservation -> Payment -> Email -> Mailpit |
| 10 | E2E Order flow | Login -> Create product -> Create order -> Checkout -> Product marked sold |
| 11 | RBAC | Non-admin DELETE blocked (403), admin succeeds, @Permissions check |
| 12 | Kafka Topics | List Kafka topics and consumer groups |
| all | Full suite | All of the above in sequence |
| unit | Unit tests | Run @app/common unit tests |
| coverage | Unit + coverage | Run unit tests and show coverage report |

**Notes:**
- Flows 5-11 depend on flow 4 (need a user first)
- Payments uses **stub mode** (`STRIPE_STUB=true`) — no real Stripe charges
- Emails go to **Mailpit** (`SMTP_HOST=mailpit`) — view at http://localhost:8025
- Media uploads go to **MinIO** — console at http://localhost:9001

Which flows would you like to run? (e.g. "all", "1,2,3", "products", "full flow")

---

Wait for the user to respond before proceeding.

## Step 2 — Verify services are running

### 2a. Check infrastructure (Docker)

```bash
docker compose --profile infra ps
```

Check that these infra containers are running: postgres, mailpit, kafka, redis, minio.

If not running:
```bash
docker compose --profile infra up -d
```

### 2b. Check all 7 app services

```bash
for svc in "4000:Reservations" "4001:Auth" "3005:Products" "3007:Orders" "3009:Media" "3013:Payments" "3014:Notifications"; do
  port="${svc%%:*}"; name="${svc##*:}"
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health/live" 2>/dev/null)
  echo "$name (:$port) -> $code"
done
```

If services are not responding, start them:
```bash
pkill -f 'nest start' || true
pnpm dev
```

## Step 3 — Run the selected tests

### Option A: Run specific E2E flows
If user chose specific flows, run the relevant curl commands using the Endpoint Reference below.

### Option B: Run unit tests
If user chose **unit**:
```bash
npx jest --roots '<rootDir>/libs/' --verbose
```

### Option C: Run unit tests with coverage
If user chose **coverage**:
```bash
npx jest --roots '<rootDir>/libs/' --coverage --verbose
```

Target is **>= 80% line coverage**.

## Step 4 — Report results

Present a **results summary** and these quick links:

| Dashboard | URL |
|-----------|-----|
| Swagger — Auth | http://localhost:4001/api/docs |
| Swagger — Reservations | http://localhost:4000/api/docs |
| Swagger — Products | http://localhost:3005/api/docs |
| Swagger — Orders | http://localhost:3007/api/docs |
| Swagger — Media | http://localhost:3009/api/docs |
| Swagger — Payments | http://localhost:3013/api/docs |
| Swagger — Notifications | http://localhost:3014/api/docs |
| Mailpit (emails) | http://localhost:8025 |
| Kafka UI | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |
| Prometheus | http://localhost:9090/targets |
| Grafana | http://localhost:3100 |

## Endpoint Reference

### Infrastructure Endpoints (all 7 services)

Every service exposes: `GET /health/live`, `GET /health/ready`, `GET /metrics`, `GET /api/docs`

### Auth Service (:4001)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/users` | No | Register user `{email, password, roles?}` |
| `GET` | `/users` | JWT | Get current user |
| `POST` | `/auth/login` | No | Login, returns JWT cookie |

### Reservations Service (:4000)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/reservations` | JWT | Create `{startDate, endDate, charge: {card, amount}}` |
| `GET` | `/reservations` | JWT | List all |
| `GET` | `/reservations/:id` | JWT | Get by ID |
| `PATCH` | `/reservations/:id` | JWT | Update |
| `DELETE` | `/reservations/:id` | JWT+Admin | Delete |

### Products Service (:3005)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/products` | JWT | Create `{name, description, price, ...}` |
| `GET` | `/products` | No | List (paginated, filtered) |
| `GET` | `/products/:id` | No | Get by ID |
| `PATCH` | `/products/:id` | JWT | Update (owner only) |
| `DELETE` | `/products/:id` | JWT | Soft delete (owner or Admin) |
| `POST` | `/products/categories` | JWT+Admin | Create category |
| `GET` | `/products/categories` | No | List categories |

### Orders Service (:3007)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/orders` | JWT | Create `{items: [{productId, quantity, unitPrice}]}` |
| `GET` | `/orders` | JWT | List user's orders |
| `GET` | `/orders/:id` | JWT | Get order |
| `PATCH` | `/orders/:id/cancel` | JWT | Cancel |
| `POST` | `/orders/:id/checkout` | JWT | Checkout `{charge: {card, amount}}` |
| `POST` | `/orders/webhook` | No | Stripe webhook |
| `GET` | `/orders/admin` | JWT+Admin | All orders (admin) |

### Media Service (:3009)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/media/upload` | JWT | Upload file (multipart, field: `file`) |
| `GET` | `/media/:key` | No | Get signed URL |
| `DELETE` | `/media/:key` | JWT | Delete file |

### Test Data

**Test user:** `{"email": "test@esales.com", "password": "Test1234!@"}`

**Test card (stub):** `{"number": "4242424242424242", "exp_month": 12, "exp_year": 2030, "cvc": "123"}`

**Test product:** `{"name": "iPhone 15", "description": "Latest smartphone", "price": 29990000}`

**Test order:** `{"items": [{"productId": 1, "quantity": 1, "unitPrice": 29990000}]}`

# Architecture Overview

## Table of Contents

- [System Diagram](#system-diagram)
- [Communication Patterns](#communication-patterns)
- [Authentication & Authorization](#authentication--authorization)
- [Services](#services)
- [Shared Library (@app/common)](#shared-library-appcommon)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)

**See also:** [API Reference](api-reference.md) | [Database](database.md) | [Deployment & Configuration](deployment.md)

---

## System Diagram

```
                          ┌──────────┐
                          │   Auth   │
                          │ JWT,RBAC │
                          │ :4001    │
                          └────┬─────┘
                               │ authenticate (RPC)
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐     ┌──────────┐
        │ Products │    │  Orders  │     │Reserva-  │
        │ (catalog)│◄───│(checkout)│     │  tions   │
        │ :3005    │    │ :3007    │     │ :4000    │
        └────┬─────┘    └────┬─────┘     └────┬─────┘
             │               │                │
             │          ┌────▼─────┐          │
             │          │ Payments │◄─────────┘
             │          │ (Stripe) │
             │          │ :3013    │
             │          └────┬─────┘
             │               │
        ┌────▼─────┐    ┌────▼─────┐
        │  Media   │    │  Notif.  │
        │(MinIO/S3)│    │ (email)  │
        │ :3009    │    │ :3014    │
        └──────────┘    └──────────┘

Arrows: RPC request-response or Kafka events
All services validate JWT via Auth service RPC
```

### Data Ownership

| Service       | Database       | Models                          | Access Pattern   |
| ------------- | -------------- | ------------------------------- | ---------------- |
| Auth          | `auth`         | `User`                          | Prisma (read/write) |
| Reservations  | `reservations` | `Reservation`                   | Prisma (read/write) |
| Products      | `products`     | `Product`, `Category`, `ProductImage` | Prisma (read/write) |
| Orders        | `orders`       | `Order`, `OrderItem`            | Prisma (read/write) |
| Payments      | —              | —                               | Stripe API (stateless) |
| Notifications | —              | —                               | SMTP (stateless) |
| Media         | —              | —                               | MinIO/S3 (stateless) |

---

## Communication Patterns

Inter-service communication uses **TCP** (default) or **Kafka** (when `KAFKA_BROKER` is set), auto-switched via `createServiceClient()`.

### Message Flow

```
Service              Pattern              Type                Direction
─────────────────────────────────────────────────────────────────────────
Any → Auth           'authenticate'       @MessagePattern     Request/Response
Any → Payments       'create_charge'      @MessagePattern     Request/Response
Payments → Notif     'notify_email'       @EventPattern       Fire-and-Forget
Orders → Products    'product.get'        @MessagePattern     Request/Response
Orders → Products    'product.check_stock' @MessagePattern    Request/Response
Orders → Products    'product.mark_sold'  @EventPattern       Fire-and-Forget
Any → Media          'media.upload'       @MessagePattern     Request/Response
Any → Media          'media.delete'       @MessagePattern     Request/Response
Any → Media          'media.get_url'      @MessagePattern     Request/Response
```

---

## Authentication & Authorization

### JWT Flow

1. Client sends `POST /auth/login` → receives JWT in HTTP-only cookie
2. Client sends requests with cookie → service extracts JWT
3. Service sends `authenticate` RPC to Auth → Auth validates and returns user
4. `JwtAuthGuard` checks `@Roles()` and `@Permissions()` metadata

### Details

| Aspect             | Implementation                                       |
| ------------------ | ---------------------------------------------------- |
| Password Hashing   | bcryptjs, 10 salt rounds                             |
| Token Type         | JWT (HS256)                                          |
| Token Storage      | HTTP-only cookie (`Authentication`)                  |
| Token Expiry       | 3600s (configurable via `JWT_EXPIRATION`)            |
| Role-Based Access  | `@Roles('Admin')` — coarse-grained role check        |
| Fine-Grained RBAC  | `@Permissions('module:action')` — per-module access  |
| Admin Bypass       | Admin role bypasses all permission checks             |

---

## Services

### Auth Service (:4001 HTTP, :3002 TCP)

User registration, login, JWT issuance, token validation. [Swagger](http://localhost:4001/api/docs)

### Reservations Service (:4000)

Hotel/venue booking with integrated payment flow. [Swagger](http://localhost:4000/api/docs)

### Products Service (:3005 HTTP, :3006 TCP)

Product catalog — CRUD, categories, search, pagination, WebSocket updates. [Swagger](http://localhost:3005/api/docs)

### Orders Service (:3007 HTTP, :3008 TCP)

Order lifecycle — create, checkout, payment, tracking. [Swagger](http://localhost:3007/api/docs)

### Media Service (:3009 HTTP, :3010 TCP)

File upload/download via MinIO (dev) / S3 (prod). [Swagger](http://localhost:3009/api/docs)

### Payments Service (:3013 HTTP, :3003 TCP)

Stripe payment processing (stub mode in dev). [Swagger](http://localhost:3013/api/docs)

### Notifications Service (:3014 HTTP, :3004 TCP)

Email via Gmail (prod) or Mailpit (dev). [Swagger](http://localhost:3014/api/docs)

---

## Shared Library (@app/common)

| Module                 | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `LoggerModule`         | Pino logger — JSON prod, pretty dev, correlation ID, service/version/env labels |
| `HealthModule`         | `/health/live`, `/health/ready` with optional DB check via `HealthModule.forDatabase()` |
| `MetricsModule`        | Prometheus `/metrics` endpoint                       |
| `RedisCacheModule`     | Redis when `REDIS_URL` set, in-memory fallback       |
| `AuditLogInterceptor`  | Logs every API call: user, method, path, status, duration, sanitized payload |
| `createServiceClient()`| Auto-switches client: TCP or Kafka                   |
| `JwtAuthGuard`         | Validates JWT via Auth RPC, checks roles + permissions |
| `@CurrentUser()`       | Injects authenticated user into handlers             |
| `@Roles(...roles)`     | Coarse-grained role metadata                         |
| `@Permissions(...p)`   | Fine-grained per-module permission metadata          |
| `PaginationQueryDto`   | Reusable pagination query (page, limit)              |
| Constants              | Service names + message pattern constants            |

---

## Technology Stack

| Layer              | Technology                                      |
| ------------------ | ----------------------------------------------- |
| Framework          | NestJS 11 + TypeScript                          |
| Transport          | TCP (default) / Kafka (via `KAFKA_BROKER` env)  |
| Database           | PostgreSQL 17 (database-per-service)            |
| ORM                | Prisma 7.8 + @prisma/adapter-pg                |
| Cache              | Redis 7 / in-memory fallback                    |
| Auth               | JWT + Passport.js + bcrypt                      |
| Payments           | Stripe API                                      |
| Storage            | MinIO (dev) / S3 (prod)                         |
| Email              | Nodemailer + Gmail OAuth2 / Mailpit             |
| WebSocket          | @nestjs/websockets + socket.io                  |
| Logging            | Pino (nestjs-pino) with correlation ID          |
| Metrics            | Prometheus (`@willsoto/nestjs-prometheus`)      |
| Health Checks      | @nestjs/terminus (DB connectivity in readiness) |
| API Docs           | Swagger / OpenAPI 3.0 (`/api/docs`)             |
| Security           | helmet, CORS, @nestjs/throttler, audit logging  |
| Runtime            | Node.js 22 (Alpine), pnpm 9.15.4               |
| Infrastructure     | Docker Compose (profiles: core / infra / monitoring) |

---

## Project Structure

```
esales-be/
├── apps/
│   ├── auth/                      # Authentication & User Management
│   ├── reservations/              # Reservation CRUD + Payment
│   ├── products/                  # Product Catalog + Categories + WebSocket
│   ├── orders/                    # Order Lifecycle + Checkout + Stripe Webhook
│   ├── media/                     # File Upload + MinIO/S3
│   ├── payments/                  # Stripe Payment Processing
│   └── notifications/             # Email Notifications
│
├── libs/common/                   # Shared library (@app/common)
├── monitoring/                    # Prometheus + Grafana configs
├── scripts/                       # init-db.sh, test-api.sh
├── docker-compose.yaml            # 7 services + infra + monitoring
├── nest-cli.json                  # 7 app projects + common lib
└── tsconfig.json
```

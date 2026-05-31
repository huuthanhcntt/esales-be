# Architecture Overview

## Table of Contents

- [System Diagram](#system-diagram)
- [Communication Patterns](#communication-patterns)
- [Authentication & Authorization](#authentication--authorization)
- [Services](#services)
  - [Reservations Service](#reservations-service)
  - [Auth Service](#auth-service)
  - [Payments Service](#payments-service)
  - [Notifications Service](#notifications-service)
  - [Shared Library (@app/common)](#shared-library-appcommon)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)

**See also:** [API Reference](api-reference.md) | [Database](database.md) | [Deployment & Configuration](deployment.md)

---

## System Diagram

```
  ┌─────────────────┐                                            ┌───────────┐
  │     (Stripe)    │◄──────────────────────────────────────────►│  (Gmail)  │
  └────────▲────────┘                                            └─────▲─────┘
           │                                                           │
           │                                                           │
  ┌────────┴────────┐     MessagePattern         ┌─────────────────────┴──┐
  │    Payments     │────────────────────────────►    Notifications       │
  │    TCP 3003     │      notify_email          │    TCP 3004            │
  └────────▲────────┘                            └────────────────────────┘
           │
           │ MessagePattern
           │ create_charge
           │
  ┌────────┴────────┐                                    ┌──────────────────┐
  │  Reservations   │───── Reservations ────────────────►│                  │
  │  HTTP 3000      │                                    │                  │
  └──▲─────────┬────┘                                    │   PostgreSQL     │
     │         │                                         │   (:5432)        │
     │         │ MessagePattern                          │                  │
     │         │ authenticate                            │  ┌────────────┐  │
     │         │                                         │  │ auth DB    │  │
     │         │  ┌───┐                                  │  │ reserv. DB │  │
POST │         └──►   │ JWT                              │  └────────────┘  │
/reservations     └──┬┘                                  │                  │
     │               │                                   └──────────▲───────┘
     │               │                                              │
     │    ┌──────────▼────────┐                                     │
     │    │       Auth        │──────── Users ──────────────────────┘
     │    │   HTTP 3001       │
  ┌──┤    │   TCP  3002       │
  │  │    └──────────▲────────┘
  │  │               │
  │  │  POST         │
  │  │  /login       │
  │  │               │
  │  └───────────────┘
  │
  │  ┌───┐
  └──┤   │ JWT
     └───┘

  Actor
```

### Flow Description

1. **Login:** Actor sends `POST /login` to **Auth** (HTTP :3001), receives a JWT cookie
2. **Create Reservation:** Actor sends `POST /reservations` to **Reservations** (HTTP :3000) with JWT
3. **Authenticate:** Reservations sends `MessagePattern('authenticate')` with JWT to **Auth** (TCP :3002), Auth validates and returns user
4. **Charge:** Reservations sends `MessagePattern('create_charge')` to **Payments** (TCP :3003)
5. **Payment:** Payments processes charge via **Stripe** (external)
6. **Notify:** Payments emits `EventPattern('notify_email')` to **Notifications** (TCP :3004)
7. **Email:** Notifications sends email via **Gmail** (external)
8. **Persist:** Reservations saves the record (with Stripe invoiceId) to **PostgreSQL**

### Data Ownership

| Service       | Database          | Table         | Access Pattern   |
| ------------- | ----------------- | ------------- | ---------------- |
| Auth          | `auth`            | `User`        | Prisma (read/write) |
| Reservations  | `reservations`    | `Reservation` | Prisma (read/write) |
| Payments      | —                 | —             | Stripe API (stateless) |
| Notifications | —                 | —             | Gmail SMTP (stateless) |

For Prisma schemas and migrations, see [Database](database.md).

---

## Communication Patterns

All inter-service communication uses **NestJS native TCP transport** (no external message broker).

### Message Flow

```
Service              Pattern              Type                Direction
─────────────────────────────────────────────────────────────────────────
Reservations → Auth  'authenticate'       @MessagePattern     Request/Response (.send())
Reservations → Pay   'create_charge'      @MessagePattern     Request/Response (.send())
Payments → Notif     'notify_email'       @EventPattern       Fire-and-Forget (.emit())
```

- **`.send()`** — Request/Response. The caller waits for the response before continuing.
- **`.emit()`** — Fire-and-Forget. The caller does not wait for the response.

### Connection Configuration

Services register TCP clients via `ClientsModule.registerAsync()`:

```typescript
ClientsModule.registerAsync([
  {
    name: AUTH_SERVICE,          // 'auth'
    useFactory: (configService: ConfigService) => ({
      transport: Transport.TCP,
      options: {
        host: configService.get('AUTH_HOST'),    // 'auth'
        port: configService.get('AUTH_PORT'),    // 3002
      },
    }),
    inject: [ConfigService],
  },
]);
```

---

## Authentication & Authorization

### Auth Flow

```
┌─────────┐   POST /auth/login    ┌──────────┐
│  Client  │ ───────────────────► │   Auth   │
│          │   email + password   │  Service │
│          │ ◄─────────────────── │          │
│          │   Set-Cookie: JWT    │          │
└─────────┘                       └──────────┘

┌──────────┐   GET /reservations  ┌──────────────┐  TCP 'authenticate' ┌──────────┐
│  Client  │ ──────────────────►  │ Reservations │ ──────────────────► │   Auth   │
│          │   Cookie: JWT        │   Service    │ ◄────────────────── │  Service │
│          │ ◄──────────────────  │              │   { user }          │          │
│          │   200 OK             └──────────────┘                     └──────────┘
└──────────┘
```

### Details

| Aspect             | Implementation                                       |
| ------------------ | ---------------------------------------------------- |
| Password Hashing   | bcryptjs, 10 salt rounds                             |
| Token Type         | JWT (HS256)                                          |
| Token Storage      | HTTP-only cookie (`Authentication`)                  |
| Token Expiry       | 3600 seconds (configurable via `JWT_EXPIRATION`)     |
| Token Payload      | `{ userId: number }`                                 |
| Role-Based Access  | `@Roles('Admin')` decorator on endpoints             |
| Strong Password    | Min 8 chars, uppercase, lowercase, number, symbol    |

### Guards

| Guard            | Strategy | Used In           |
| ---------------- | -------- | ----------------- |
| `LocalAuthGuard` | Local    | `POST /auth/login` |
| `JwtAuthGuard`   | JWT      | All protected endpoints + TCP `authenticate` |

### JWT Extraction Order

The JWT strategy extracts the token in this order:

1. `request.cookies.Authentication`
2. `request.Authentication` (body)
3. `request.headers.Authentication` (custom header)

### Role-Based Access Control

```typescript
// Controller — restrict endpoint to Admin role
@Delete(':id')
@Roles('Admin')
async remove(@Param('id') id: string) { ... }

// JwtAuthGuard — checks roles from @Roles() metadata
const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
if (requiredRoles && !res.roles?.includes(role)) {
  throw new UnauthorizedException();
}
```

---

## Services

### Reservations Service

The main HTTP API gateway. Handles reservation CRUD and orchestrates calls to Auth and Payments services. See [API Reference](api-reference.md#reservations-service-host-port-4000) for endpoints.

| Property    | Value                                 |
| ----------- | ------------------------------------- |
| Type        | HTTP REST API                         |
| Port        | 3000 (host: 4000)                     |
| Database    | PostgreSQL (`reservations` database)  |
| ORM         | Prisma                                |
| Depends On  | Auth (TCP :3002), Payments (TCP :3003)|

**Module Imports:**
- `ConfigModule.forRoot()` with Joi validation
- `ClientsModule.registerAsync()` — AUTH_SERVICE (TCP), PAYMENTS_SERVICE (TCP)
- `LoggerModule`
- `HealthModule`

**Service Methods:**

```typescript
create(createReservationDto, user)
  // Calls payments.send('create_charge', {...charge, email})
  // Creates reservation with invoiceId from payment response

findAll()       // Get all reservations
findOne(id)     // Get reservation by ID
update(id, dto) // Update reservation
remove(id)      // Delete (Admin only)
```

### Auth Service

Handles user registration, login, JWT token issuance, and token validation for other services. See [API Reference](api-reference.md#auth-service-host-port-4001) for endpoints.

| Property    | Value                                 |
| ----------- | ------------------------------------- |
| Type        | HTTP + TCP Microservice (hybrid)      |
| HTTP Port   | 3001 (host: 4001)                     |
| TCP Port    | 3002 (host: 4002)                     |
| Database    | PostgreSQL (`auth` database)          |
| ORM         | Prisma                                |

**Module Imports:**
- `UsersModule`
- `LoggerModule`
- `ConfigModule.forRoot()` with Joi validation
- `JwtModule.registerAsync()` — secret from `JWT_SECRET`
- `HealthModule`

**Providers:** `AuthService`, `LocalStrategy`, `JwtStrategy` — see [Authentication & Authorization](#authentication--authorization) for strategy details.

**Users Module:**

| Method | Description |
| ------ | ----------- |
| `create()` | Creates user with bcrypt hashed password |
| `verifyUser()` | Validates email/password via bcrypt comparison |
| `getUser()` | Retrieves user by ID |

### Payments Service

Processes payments via Stripe. TCP-only service with no HTTP endpoints.

| Property    | Value                                 |
| ----------- | ------------------------------------- |
| Type        | TCP Microservice only                 |
| TCP Port    | 3003                                  |
| Depends On  | Notifications (TCP :3004)             |
| External    | Stripe API                            |

**Module Imports:**
- `ConfigModule.forRoot()` with Joi validation
- `LoggerModule`
- `ClientsModule.registerAsync()` — NOTIFICATIONS_SERVICE (TCP)

**Payment Flow:**

```
1. Receives 'create_charge' message (card, amount, email)
2. stripe.paymentMethods.create() — card details
3. stripe.paymentIntents.create() — amount * 100 (cents), currency: 'usd', confirm: true
4. Emits 'notify_email' event to Notifications service (fire-and-forget)
5. Returns PaymentIntent to caller
```

### Notifications Service

Sends email notifications via Gmail SMTP with OAuth2. TCP-only, event-driven service.

| Property    | Value                                 |
| ----------- | ------------------------------------- |
| Type        | TCP Microservice only                 |
| TCP Port    | 3004                                  |
| External    | Gmail SMTP (OAuth2)                   |

**Module Imports:**
- `ConfigModule.forRoot()` with Joi validation
- `LoggerModule`

**Email:** Gmail OAuth2 via Nodemailer — see [Environment Variables](deployment.md#notifications-appsnotificationsenv) for config.

### Shared Library (@app/common)

Reusable modules shared across all services via the `@app/common` path alias.

| Module                 | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `LoggerModule`         | Pino logger — JSON in production, pretty-print in dev |
| `HealthModule`         | Health endpoints: `/health/live`, `/health/ready` (@nestjs/terminus) |
| `MetricsModule`        | Prometheus `/metrics` endpoint (@willsoto/nestjs-prometheus) |
| `RedisCacheModule`     | Cache layer — Redis when `REDIS_URL` set, in-memory fallback |
| `createServiceClient()`| Auto-switches client transport: TCP (default) or Kafka (`KAFKA_BROKER`) |
| `createMicroserviceOptions()` | Auto-switches server transport: TCP or Kafka |
| `JwtAuthGuard`         | Validates JWT by sending `authenticate` to Auth service |
| `@CurrentUser()`       | Decorator to inject authenticated user into handlers |
| `@Roles(...roles)`     | Decorator for role-based access control metadata     |
| `User` interface       | `id`, `email`, `password`, `roles`                   |
| `CreateChargeDto`      | DTO: `card` (CardDto), `amount` (number)             |
| `CardDto`              | DTO: `cvc`, `exp_month`, `exp_year`, `number`        |
| Constants              | `AUTH_SERVICE`, `PAYMENTS_SERVICE`, `NOTIFICATIONS_SERVICE` |

---

## Technology Stack

| Layer              | Technology                                      |
| ------------------ | ----------------------------------------------- |
| Framework          | NestJS 11 + TypeScript                          |
| Transport          | TCP (default) / Kafka (via `KAFKA_BROKER` env)  |
| Database           | PostgreSQL 17 (database-per-service)            |
| ORM                | Prisma 7.8 + @prisma/adapter-pg                |
| Cache              | Redis 7 (via `REDIS_URL` env) / in-memory fallback |
| Auth               | JWT + Passport.js + bcrypt                      |
| Payments           | Stripe API                                      |
| Email              | Nodemailer + Gmail OAuth2                       |
| Logging            | Pino (nestjs-pino) — JSON in prod, pretty in dev |
| Metrics            | Prometheus (`/metrics` via @willsoto/nestjs-prometheus) |
| Health Checks      | @nestjs/terminus (`/health/live`, `/health/ready`) |
| API Docs           | Swagger / OpenAPI 3.0 (`/api/docs`)             |
| Security           | helmet, CORS, @nestjs/throttler (100 req/min)   |
| Validation         | Joi (config) + class-validator (DTOs)           |
| Runtime            | Node.js 22 (Alpine)                             |
| Package Manager    | pnpm 9.15.4                                     |
| Infrastructure     | Docker Compose (profiles: core / infra / monitoring) |

---

## Project Structure

```
esales-be/
├── apps/
│   ├── reservations/              # HTTP API - Reservation CRUD
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Reservation model
│   │   │   └── migrations/        # Database migrations
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── reservations.module.ts
│   │   │   ├── reservations.controller.ts
│   │   │   ├── reservations.service.ts
│   │   │   ├── prisma.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-reservation.dto.ts
│   │   │   │   └── update-reservation.dto.ts
│   │   │   └── generated/prisma/  # Auto-generated Prisma client
│   │   ├── Dockerfile
│   │   └── .env
│   │
│   ├── auth/                      # Authentication & User Management
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # User model
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── local.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── local-auth.guard.ts
│   │   │   └── users/
│   │   │       ├── users.module.ts
│   │   │       ├── users.controller.ts
│   │   │       ├── users.service.ts
│   │   │       ├── prisma.service.ts
│   │   │       └── dto/
│   │   │           ├── create-user.dto.ts
│   │   │           └── get-user.dto.ts
│   │   ├── Dockerfile
│   │   └── .env
│   │
│   ├── payments/                  # Stripe Payment Processing (TCP only)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── payments.module.ts
│   │   │   ├── payments.controller.ts
│   │   │   ├── payments.service.ts
│   │   │   └── dto/
│   │   │       └── payments-create-charge.dto.ts
│   │   ├── Dockerfile
│   │   └── .env
│   │
│   └── notifications/             # Email Notifications (TCP only)
│       ├── src/
│       │   ├── main.ts
│       │   ├── notifications.module.ts
│       │   ├── notifications.controller.ts
│       │   ├── notifications.service.ts
│       │   └── dto/
│       │       └── notify-email.dto.ts
│       ├── Dockerfile
│       └── .env
│
├── libs/
│   └── common/                    # Shared library (@app/common)
│       └── src/
│           ├── index.ts
│           ├── auth/              # JwtAuthGuard (cross-service JWT validation)
│           ├── cache/             # RedisCacheModule (Redis or in-memory)
│           ├── constants/         # Service name constants
│           ├── decorators/        # @CurrentUser(), @Roles()
│           ├── dto/               # Shared DTOs (CreateChargeDto, CardDto)
│           ├── health/            # HealthController (/health/live, /health/ready)
│           ├── interfaces/        # User interface
│           ├── logger/            # Pino LoggerModule (JSON prod / pretty dev)
│           ├── metrics/           # PrometheusModule (/metrics)
│           └── transport/         # TCP/Kafka transport helpers
│
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml         # Scrape configs for all services
│   └── grafana/
│       └── provisioning/
│           ├── datasources/       # Prometheus + Loki datasources
│           └── dashboards/        # Dashboard provider config
│
├── http/                          # HTTP testing scripts
├── docker-compose.yaml
├── scripts/
│   ├── init-db.sh                 # Creates per-service databases
│   └── test-api.sh                # E2E API test suite
├── package.json
├── pnpm-workspace.yaml
├── nest-cli.json
└── tsconfig.json
```

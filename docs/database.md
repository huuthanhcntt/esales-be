# Database

**Engine:** PostgreSQL 17
**Connection:** `postgresql://postgres:postgres@postgres:5432/<database>`
**ORM:** Prisma 7.3 + `@prisma/adapter-pg` for connection pooling

---

## Database-per-Service Pattern

Each microservice owns its own database, created by `scripts/init-db.sh` on first startup:

```sql
CREATE DATABASE auth;
CREATE DATABASE reservations;
CREATE DATABASE payments;
CREATE DATABASE notifications;
```

Only `auth` and `reservations` use Prisma schemas. The `payments` and `notifications` databases are provisioned but currently unused (Stripe and Gmail handle their own state).

---

## Prisma Schemas

### User (Auth Service)

```prisma
// apps/auth/prisma/schema.prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id       Int      @id @default(autoincrement())
  email    String
  password String
  roles    String[]
}
```

### Reservation (Reservations Service)

```prisma
// apps/reservations/prisma/schema.prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Reservation {
  id        Int      @id @default(autoincrement())
  timestamp DateTime
  startDate DateTime
  endDate   DateTime
  userId    Int
  invoiceId String
}
```

---

## Prisma Service Pattern

Both services use `PrismaService` extending `PrismaClient` with `@prisma/adapter-pg`:

```typescript
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }
}
```

### Usage in Services

```typescript
// Auth — User operations
this.prismaService.user.create({ data: { email, password, roles } })
this.prismaService.user.findFirstOrThrow({ where: { email } })
this.prismaService.user.findUniqueOrThrow({ where: { id } })

// Reservations — Reservation operations
this.prismaService.reservation.create({ data: { timestamp, startDate, endDate, userId, invoiceId } })
this.prismaService.reservation.findMany()
this.prismaService.reservation.findUniqueOrThrow({ where: { id } })
this.prismaService.reservation.update({ where: { id }, data: { ... } })
this.prismaService.reservation.delete({ where: { id } })
```

---

## Migrations

```bash
# Generate a new migration (development)
pnpm prisma migrate dev --name <migration_name>

# Apply pending migrations (production)
pnpm prisma migrate deploy

# Regenerate Prisma client after schema changes
pnpm prisma generate
```

Docker startup command for services with Prisma:

```bash
pnpm prisma migrate deploy && pnpm prisma generate && node dist/apps/<service>/main
```

---

## Connecting to PostgreSQL

```bash
# From the host (port 5433 mapped to container 5432)
psql -h localhost -p 5433 -U postgres -d auth
psql -h localhost -p 5433 -U postgres -d reservations

# From inside the Docker network
docker exec -it esales-postgres-1 psql -U postgres -d auth
docker exec -it esales-postgres-1 psql -U postgres -d reservations
```

# Database

**Engine:** PostgreSQL 17
**Connection:** `postgresql://postgres:postgres@postgres:5432/<database>`
**ORM:** Prisma 7.8 + `@prisma/adapter-pg` for connection pooling

---

## Database-per-Service Pattern

Each microservice owns its own database, created by `scripts/init-db.sh` on first startup:

```sql
CREATE DATABASE auth;
CREATE DATABASE reservations;
CREATE DATABASE payments;
CREATE DATABASE notifications;
CREATE DATABASE products;
CREATE DATABASE orders;
```

Services with Prisma schemas: `auth`, `reservations`, `products`, `orders`
Stateless services (no DB): `payments`, `notifications`, `media`

---

## Prisma Schemas

### User (Auth Service)

```prisma
// apps/auth/prisma/schema.prisma
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
model Reservation {
  id        Int      @id @default(autoincrement())
  timestamp DateTime
  startDate DateTime
  endDate   DateTime
  userId    Int
  invoiceId String
}
```

### Product, Category, ProductImage (Products Service)

```prisma
// apps/products/prisma/schema.prisma
model Product {
  id          Int           @id @default(autoincrement())
  name        String
  description String
  price       Float
  currency    String        @default("VND")
  sku         String?       @unique
  categoryId  Int?
  category    Category?     @relation(fields: [categoryId], references: [id])
  status      ProductStatus @default(ACTIVE)
  userId      Int
  images      ProductImage[]
  metadata    Json?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  deletedAt   DateTime?     // soft delete
}

model Category {
  id        Int        @id @default(autoincrement())
  name      String     @unique
  parentId  Int?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  products  Product[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model ProductImage {
  id        Int      @id @default(autoincrement())
  productId Int
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  key       String   // S3/MinIO object key
  isPrimary Boolean  @default(false)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
}

enum ProductStatus { DRAFT, ACTIVE, SOLD, ARCHIVED }
```

### Order, OrderItem (Orders Service)

```prisma
// apps/orders/prisma/schema.prisma
model Order {
  id              Int         @id @default(autoincrement())
  orderNumber     String      @unique @default(cuid())
  userId          Int
  status          OrderStatus @default(PENDING)
  items           OrderItem[]
  totalAmount     Float
  currency        String      @default("VND")
  invoiceId       String?     // Stripe payment intent ID
  notes           String?
  shippingAddress Json?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model OrderItem {
  id        Int   @id @default(autoincrement())
  orderId   Int
  order     Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId Int
  quantity  Int   @default(1)
  unitPrice Float
  total     Float
}

enum OrderStatus { PENDING, PAYMENT_PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED }
```

---

## Prisma Service Pattern

All DB services use `PrismaService` extending `PrismaClient` with `@prisma/adapter-pg`:

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

---

## Migrations

```bash
# Run from the service directory (e.g., apps/products/)
npx dotenv-cli -e .env.local -- pnpm prisma migrate dev --name <name>   # dev
npx dotenv-cli -e .env.local -- pnpm prisma migrate deploy              # deploy
npx dotenv-cli -e .env.local -- pnpm prisma generate                    # regen client
```

---

## Connecting to PostgreSQL

```bash
# From host (port 5433)
psql -h localhost -p 5433 -U postgres -d products
psql -h localhost -p 5433 -U postgres -d orders

# From inside Docker
docker exec -it esales-postgres-1 psql -U postgres -d products
```

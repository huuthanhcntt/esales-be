# New Service Checklist

Step-by-step guide for adding a new microservice to the eSales platform. Follow every section in order — each step references exact file patterns from existing services.

---

## 1. Plan Your Service

Before writing code, define these:

| Decision | Example (Products) |
|----------|-------------------|
| Service name | `products` |
| HTTP port | `3005` |
| TCP/Kafka port | `3006` |
| Docker exposed port | `4005` |
| Has database? | Yes → PostgreSQL `products` |
| Has file storage? | No (delegates to Media service) |
| Depends on which services? | Auth (JWT validation) |
| Exposes HTTP API? | Yes → needs Swagger, helmet, CORS, throttler |
| Exposes RPC handlers? | Yes → `@MessagePattern` for inter-service calls |
| Needs WebSocket? | Yes → `@WebSocketGateway` |

**Port allocation:** Check existing ports in `docker-compose.yaml` to avoid collisions. Current allocation:

```
Auth:          HTTP 3001, TCP 3002, Docker 4001/4002
Reservations:  HTTP 3000, Docker 4000
Payments:      TCP 3003
Notifications: TCP 3004
Products:      HTTP 3005, TCP 3006, Docker 4005
Orders:        HTTP 3007, TCP 3008, Docker 4007
Media:         HTTP 3009, TCP 3010, Docker 4009
```

---

## 2. Scaffold the Service

Create the directory structure under `apps/<service>/`:

```
apps/<service>/
├── src/
│   ├── main.ts                    # Bootstrap entry point
│   ├── <service>.module.ts        # Root module
│   ├── <service>.controller.ts    # HTTP + RPC endpoints
│   ├── <service>.service.ts       # Business logic
│   ├── prisma.service.ts          # Prisma ORM wrapper (if DB)
│   ├── dto/
│   │   ├── create-<entity>.dto.ts
│   │   ├── update-<entity>.dto.ts
│   │   └── query-<entity>.dto.ts  # Pagination + filters
│   └── generated/prisma/          # Auto-generated (git-ignored)
├── prisma/                        # (if DB)
│   └── schema.prisma
├── prisma.config.ts               # (if DB)
├── Dockerfile
├── tsconfig.app.json
├── package.json
├── .env                           # Docker environment
├── .env.local                     # Local dev environment
├── .env.example
└── .env.local.example
```

---

## 3. File-by-File Implementation

### 3.1 `tsconfig.app.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/<service>"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### 3.2 `package.json`

```json
{
  "name": "@esales/<service>",
  "version": "1.0.0",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "migrate": "dotenv -e .env.local -- pnpm prisma migrate dev"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "dotenv": "^16.5.0",
    "pg": "^8.16.0",
    "prisma": "^7.8.0"
  },
  "devDependencies": {
    "dotenv-cli": "^11.0.0"
  }
}
```

> **No database?** Remove prisma/pg dependencies. Only keep what the service needs (e.g., `minio` for media).

### 3.3 `prisma/schema.prisma` (if DB)

```prisma
generator client {
    provider     = "prisma-client"
    output       = "../src/generated/prisma"
    moduleFormat = "cjs"
}

datasource db {
    provider = "postgresql"
}

model YourEntity {
    id        Int      @id @default(autoincrement())
    name      String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
}
```

### 3.4 `prisma.config.ts` (if DB)

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

### 3.5 `src/prisma.service.ts` (if DB)

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }
}
```

### 3.6 DTOs

**Create DTO** — use `class-validator` + `@ApiProperty`:

```typescript
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEntityDto {
  @ApiProperty({ example: 'Example name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}
```

**Update DTO** — always extend with `PartialType`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateEntityDto } from './create-entity.dto';

export class UpdateEntityDto extends PartialType(CreateEntityDto) {}
```

**Query DTO** — extend `PaginationQueryDto` from common lib:

```typescript
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@app/common';

export class QueryEntityDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'search term' })
  @IsOptional()
  @IsString()
  search?: string;
}
```

### 3.7 `src/<service>.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResponse, User } from '@app/common';
import { PrismaService } from './prisma.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { QueryEntityDto } from './dto/query-entity.dto';

@Injectable()
export class MyService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(dto: CreateEntityDto, user: User) {
    return this.prismaService.entity.create({
      data: { ...dto, userId: user.id },
    });
  }

  async findAll(query: QueryEntityDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: any = {};

    const [data, total] = await Promise.all([
      this.prismaService.entity.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prismaService.entity.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const entity = await this.prismaService.entity.findUnique({ where: { id } });
    if (!entity) throw new NotFoundException(`Entity #${id} not found`);
    return entity;
  }

  async update(id: number, dto: UpdateEntityDto) {
    await this.findOne(id);
    return this.prismaService.entity.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prismaService.entity.delete({ where: { id } });
  }
}
```

### 3.8 `src/<service>.controller.ts`

```typescript
import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CurrentUser, JwtAuthGuard, Roles, User } from '@app/common';
import { MyService } from './<service>.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { QueryEntityDto } from './dto/query-entity.dto';

@Controller('entities')
export class MyController {
  constructor(private readonly myService: MyService) {}

  // --- HTTP Endpoints ---

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateEntityDto, @CurrentUser() user: User) {
    return this.myService.create(dto, user);
  }

  @Get()
  async findAll(@Query() query: QueryEntityDto) {
    return this.myService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.myService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateEntityDto) {
    return this.myService.update(+id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles('Admin')
  async remove(@Param('id') id: string) {
    return this.myService.remove(+id);
  }

  // --- Inter-Service RPC ---

  @MessagePattern('entity.get')
  async rpcGet(@Payload() data: { id: number }) {
    return this.myService.findOne(data.id);
  }
}
```

### 3.9 `src/<service>.module.ts`

```typescript
import { Module } from '@nestjs/common';
import * as Joi from 'joi';
import {
  LoggerModule, AUTH_SERVICE, HealthModule, MetricsModule,
  RedisCacheModule, createServiceClient,
} from '@app/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MyController } from './<service>.controller';
import { MyService } from './<service>.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    // --- Required for ALL services ---
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
        TCP_PORT: Joi.number().required(),
        AUTH_HOST: Joi.string().required(),
        AUTH_PORT: Joi.number().required(),
        DATABASE_URL: Joi.string().required(),  // remove if no DB
      }),
    }),
    HealthModule,
    MetricsModule,

    // --- Required for HTTP services ---
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),

    // --- Required for services that call other services ---
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE,
        useFactory: (configService: ConfigService) =>
          createServiceClient('auth', configService, 'AUTH_HOST', 'AUTH_PORT'),
        inject: [ConfigService],
      },
      // Add other service clients here as needed
    ]),

    // --- Optional ---
    RedisCacheModule,  // Enable caching (Redis when REDIS_URL set, in-memory fallback)
  ],
  controllers: [MyController],
  providers: [
    MyService,
    PrismaService,  // remove if no DB
    { provide: APP_GUARD, useClass: ThrottlerGuard },  // HTTP services only
  ],
})
export class MyModule {}
```

### 3.10 `src/main.ts`

**Pattern A: HTTP + Microservice** (most services)

```typescript
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { createMicroserviceOptions } from '@app/common';
import { MyModule } from './<service>.module';

async function bootstrap() {
  const app = await NestFactory.create(MyModule);
  const configService = app.get(ConfigService);

  // Register microservice transport (TCP or Kafka based on KAFKA_BROKER env)
  app.connectMicroservice(
    createMicroserviceOptions('<service>', configService, 'TCP_PORT'),
  );

  // Middleware
  app.use(cookieParser());
  app.use(helmet());
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useLogger(app.get(Logger));

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('eSales <Service> API')
    .setDescription('<Service> management endpoints')
    .setVersion('1.0')
    .addCookieAuth('Authentication')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.startAllMicroservices();
  await app.listen(configService.get('PORT'));
}
bootstrap();
```

**Pattern B: Microservice-only** (TCP/Kafka only, no HTTP API — e.g., payments, notifications)

```typescript
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { createMicroserviceOptions } from '@app/common';
import { MyModule } from './<service>.module';

async function bootstrap() {
  const app = await NestFactory.create(MyModule);
  const configService = app.get(ConfigService);
  app.connectMicroservice(
    createMicroserviceOptions('<service>', configService, 'PORT'),
  );
  app.useLogger(app.get(Logger));
  await app.startAllMicroservices();
  await app.listen(configService.get('HTTP_PORT') || 3015); // for /metrics and /health
}
bootstrap();
```

### 3.11 `Dockerfile`

```dockerfile
FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json
COPY apps/<service>/package.json apps/<service>/package.json

RUN npm install -g pnpm@9.15.4

RUN pnpm install

COPY apps/<service> apps/<service>
COPY libs libs

RUN pnpm -w run build <service>

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY apps/<service>/package.json apps/<service>/package.json

RUN npm install -g pnpm@9.15.4

RUN pnpm install --prod

COPY --from=development /usr/src/app/dist ./dist
# Include these two lines ONLY if the service has Prisma:
COPY --from=development /usr/src/app/apps/<service>/prisma.config.ts ./apps/<service>/prisma.config.ts
COPY --from=development /usr/src/app/apps/<service>/prisma ./apps/<service>/prisma

# With Prisma:
CMD ["sh", "-c", "cd apps/<service> && pnpm prisma migrate deploy && cd ../.. && node dist/apps/<service>/main"]
# Without Prisma:
# CMD ["node", "dist/apps/<service>/main"]
```

### 3.12 Environment Files

**.env** (Docker network — services reference each other by container name):

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/<service>
PORT=<http_port>
TCP_PORT=<tcp_port>

AUTH_HOST=auth
AUTH_PORT=3002

KAFKA_BROKER=kafka:9092
REDIS_URL=redis://redis:6379
```

**.env.local** (Local dev — services on localhost):

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/<service>
PORT=<http_port>
TCP_PORT=<tcp_port>

AUTH_HOST=localhost
AUTH_PORT=3002

KAFKA_BROKER=localhost:9093
REDIS_URL=redis://localhost:6380
```

> Create `.env.example` and `.env.local.example` with the same content as templates.

---

## 4. Register the Service

### 4.1 `nest-cli.json`

Add to the `projects` object:

```json
"<service>": {
  "type": "application",
  "root": "apps/<service>",
  "entryFile": "main",
  "sourceRoot": "apps/<service>/src",
  "compilerOptions": {
    "tsConfigPath": "apps/<service>/tsconfig.app.json"
  }
}
```

### 4.2 `package.json` (root)

Add dev script:

```json
"dev:<service>": "dotenv -e apps/<service>/.env.local -- nest start <service> --watch"
```

Update the `dev` script to include the new service in the `concurrently` command.

### 4.3 `scripts/init-db.sh` (if DB)

Add:

```sql
CREATE DATABASE <service>;
```

### 4.4 `docker-compose.yaml`

Add service definition:

```yaml
<service>:
  build:
    context: .
    dockerfile: ./apps/<service>/Dockerfile
    target: development
  command: sh -c "cd apps/<service> && pnpm prisma migrate deploy && pnpm prisma generate && cd ../.. && pnpm run start:dev <service>"
  depends_on:
    postgres:
      condition: service_healthy
  env_file:
    - ./apps/<service>/.env
  ports:
    - '<docker_port>:<http_port>'
  volumes:
    - .:/usr/src/app
  networks:
    - esales-network
  restart: unless-stopped
```

> **No database?** Remove `depends_on: postgres`, remove Prisma commands from `command`.

### 4.5 `monitoring/prometheus/prometheus.yml`

Add scrape target:

```yaml
- job_name: '<service>'
  metrics_path: /metrics
  static_configs:
    - targets: ['<service>:<http_port>']
  scrape_interval: 10s
```

---

## 5. Shared Library Updates

### 5.1 Service Constant (if other services call this one)

Add to `libs/common/src/constants/services.ts`:

```typescript
export const MY_SERVICE = '<service>';
```

### 5.2 Message Pattern Constants (if RPC handlers)

Add to `libs/common/src/constants/patterns.ts`:

```typescript
export const MY_PATTERNS = {
  GET: '<service>.get',
  CREATE: '<service>.create',
} as const;
```

### 5.3 Shared DTOs (if cross-service data)

Add to `libs/common/src/dto/` and export from `libs/common/src/dto/index.ts`.

---

## 6. Install & Generate

```bash
# Install workspace dependencies
pnpm install

# Generate Prisma client (if DB)
cd apps/<service> && pnpm prisma generate && cd ../..

# Create first migration (if DB, local dev)
cd apps/<service> && pnpm run migrate && cd ../..
```

---

## 7. Verification Checklist

Run these checks before considering the service complete:

### Build

- [ ] `pnpm -w run build <service>` compiles with zero errors
- [ ] All other services still build: `pnpm -w run build auth` (etc.)

### Runtime

- [ ] `pnpm dev:<service>` starts without errors
- [ ] HTTP endpoints respond: `curl localhost:<port>/`
- [ ] Swagger UI loads: `open http://localhost:<port>/api/docs`

### Observability

- [ ] Metrics endpoint works: `curl localhost:<port>/metrics`
- [ ] Health liveness: `curl localhost:<port>/health/live` → `200`
- [ ] Health readiness: `curl localhost:<port>/health/ready` → `200`

### Security

- [ ] Protected endpoints return 401 without JWT
- [ ] `@Roles('Admin')` endpoints return 403 for non-admin users
- [ ] Rate limiter active (101st request in 60s returns 429)

### Inter-Service

- [ ] `@MessagePattern` handlers respond when called from other services
- [ ] JWT validation works via Auth service RPC

### Docker

- [ ] `docker compose build <service>` succeeds
- [ ] `docker compose up <service>` starts and connects to DB
- [ ] Prisma migrations apply on container startup (if DB)

### Tests

- [ ] Unit tests exist: `apps/<service>/src/*.spec.ts`
- [ ] Tests pass: `pnpm test -- --testPathPattern <service>`
- [ ] Coverage >= 80%: `pnpm test:cov -- --testPathPattern <service>`

---

## 8. Documentation Updates

After the service is functional, update these docs:

- [ ] **`docs/architecture.md`** — Add service to system diagram, data ownership table, communication patterns, project structure
- [ ] **`docs/api-reference.md`** — Add all HTTP endpoints with request/response examples
- [ ] **`docs/database.md`** — Add Prisma schema, model descriptions, init-db.sh entry (if DB)
- [ ] **`docs/deployment.md`** — Add to core services table, env vars section, Prometheus targets, Swagger URLs

---

## Quick Reference: What Goes Where

| What | Where |
|------|-------|
| Service source code | `apps/<service>/src/` |
| Prisma schema | `apps/<service>/prisma/schema.prisma` |
| Service-specific deps | `apps/<service>/package.json` |
| Docker build | `apps/<service>/Dockerfile` |
| Env vars (Docker) | `apps/<service>/.env` |
| Env vars (local) | `apps/<service>/.env.local` |
| NestJS project config | `nest-cli.json` → `projects.<service>` |
| Dev script | `package.json` → `scripts.dev:<service>` |
| Docker container | `docker-compose.yaml` |
| DB creation | `scripts/init-db.sh` |
| Prometheus target | `monitoring/prometheus/prometheus.yml` |
| Shared constants | `libs/common/src/constants/` |
| Shared DTOs | `libs/common/src/dto/` |
| Guards & decorators | `libs/common/src/auth/`, `libs/common/src/decorators/` |

---

## Common Patterns

### Calling Another Service (RPC)

```typescript
// In module — register the client
ClientsModule.registerAsync([{
  name: PRODUCTS_SERVICE,
  useFactory: (cs: ConfigService) =>
    createServiceClient('products', cs, 'PRODUCTS_HOST', 'PRODUCTS_PORT'),
  inject: [ConfigService],
}])

// In service — inject and call
@Inject(PRODUCTS_SERVICE) private readonly productsClient: ClientProxy

// Request-response (waits for reply)
const product = await lastValueFrom(
  this.productsClient.send(PRODUCT_PATTERNS.GET, { id: 1 }),
);

// Fire-and-forget event
this.notificationsClient.emit('notify_email', { email, text });
```

### Kafka Compatibility

When using `ClientProxy.send()` with Kafka transport, services must subscribe to response topics in `onModuleInit()`:

```typescript
async onModuleInit() {
  if (typeof (this.client as any).subscribeToResponseOf === 'function') {
    (this.client as any).subscribeToResponseOf('pattern_name');
    await this.client.connect();
  }
}
```

### Pagination

Use `PaginationQueryDto` from `@app/common` and return `PaginatedResponse<T>`:

```typescript
return {
  data: items,
  meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
};
```

### Soft Delete

Prefer soft delete with a `deletedAt` column instead of hard delete:

```prisma
model Entity {
  deletedAt DateTime?
}
```

```typescript
// Filter out deleted records
const where = { deletedAt: null };

// Soft delete
await this.prisma.entity.update({ where: { id }, data: { deletedAt: new Date() } });
```

---

## 9. Swagger / OpenAPI Documentation

Every HTTP service must expose Swagger UI at `/api/docs`. This section covers everything needed to produce complete, usable API docs.

### 9.1 Setup in `main.ts`

Already shown in section 3.10 (Pattern A). The key parts:

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('eSales <Service> API')        // Service-specific title
  .setDescription('<Service> endpoints')    // Brief purpose
  .setVersion('1.0')
  .addCookieAuth('Authentication')          // Match JWT auth pattern
  .build();
SwaggerModule.setup(
  'api/docs',
  app,
  () => SwaggerModule.createDocument(app, swaggerConfig),
);
```

> **TCP-only services** (no HTTP API) do NOT need Swagger — they have no user-facing endpoints.

### 9.2 DTO Decorators

Every DTO field exposed via HTTP must have Swagger decorators. This is the **minimum requirement**.

#### Required fields — `@ApiProperty`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'iPhone 15 Pro Max' })
  @IsString()
  name: string;

  @ApiProperty({ example: 29990000 })
  @IsNumber()
  @Min(0)
  price: number;
}
```

#### Optional fields — `@ApiPropertyOptional`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiPropertyOptional({ example: 'VND', default: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  categoryId?: number;
}
```

#### Enum fields

```typescript
@ApiPropertyOptional({ enum: ProductStatus, default: 'ACTIVE' })
@IsOptional()
@IsEnum(ProductStatus)
status?: ProductStatus;
```

#### Nested objects

```typescript
@ApiProperty({ type: CardDto })
@IsDefined()
@IsNotEmptyObject()
@ValidateNested()
@Type(() => CardDto)
card: CardDto;
```

#### Array of nested objects

```typescript
@ApiProperty({ type: [OrderItemDto] })
@IsArray()
@ArrayMinSize(1)
@ValidateNested({ each: true })
@Type(() => OrderItemDto)
items: OrderItemDto[];
```

#### JSON / arbitrary object

```typescript
@ApiPropertyOptional({
  example: { street: '123 Nguyen Hue', city: 'Ho Chi Minh' },
})
@IsOptional()
shippingAddress?: Record<string, any>;
```

### 9.3 Controller Decorators

Add Swagger decorators to controllers for richer docs.

#### Tag grouping

```typescript
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Products')
@Controller('products')
export class ProductsController { ... }
```

#### Operation descriptions

```typescript
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Post()
@ApiOperation({ summary: 'Create a product', description: 'Creates a new product listing. Requires authentication.' })
@ApiResponse({ status: 201, description: 'Product created successfully' })
@ApiResponse({ status: 401, description: 'Unauthorized — JWT required' })
@ApiResponse({ status: 400, description: 'Validation failed' })
@UseGuards(JwtAuthGuard)
async create(@Body() dto: CreateProductDto, @CurrentUser() user: User) { ... }
```

#### Query parameter documentation (for pagination/filters)

```typescript
@Get()
@ApiOperation({ summary: 'List products with pagination and filters' })
@ApiResponse({ status: 200, description: 'Paginated product list' })
async findAll(@Query() query: QueryProductsDto) { ... }
```

> Query DTOs with `@ApiPropertyOptional` are auto-documented by Swagger when used with `@Query()`.

#### Path parameters

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get product by ID' })
@ApiParam({ name: 'id', type: Number, description: 'Product ID' })
@ApiResponse({ status: 200, description: 'Product found' })
@ApiResponse({ status: 404, description: 'Product not found' })
async findOne(@Param('id') id: string) { ... }
```

#### Non-DTO request bodies (e.g., login)

When the endpoint uses guards instead of a DTO (like `@UseGuards(LocalAuthGuard)`), use `@ApiBody`:

```typescript
@Post('login')
@ApiBody({
  schema: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', example: 'user@esales.com' },
      password: { type: 'string', example: 'StrongPass1!@' },
    },
  },
})
async login(@CurrentUser() user: User) { ... }
```

#### File upload

```typescript
import { ApiConsumes, ApiBody } from '@nestjs/swagger';

@Post('upload')
@ApiOperation({ summary: 'Upload a file' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
      folder: { type: 'string', example: 'products' },
    },
  },
})
@UseInterceptors(FileInterceptor('file'))
async upload(@UploadedFile() file: Express.Multer.File) { ... }
```

### 9.4 Swagger Checklist

Before marking Swagger as complete for your service:

- [ ] `/api/docs` loads in the browser
- [ ] All endpoints are listed (no missing routes)
- [ ] Every DTO field has `@ApiProperty` or `@ApiPropertyOptional` with `example`
- [ ] Enum fields show allowed values in the dropdown
- [ ] Nested objects are expandable in the schema view
- [ ] Auth-protected endpoints show the lock icon (from `addCookieAuth`)
- [ ] "Try it out" works for public GET endpoints
- [ ] File upload endpoints show the file picker (from `@ApiConsumes`)
- [ ] Response codes are documented (`@ApiResponse`)

---

## 10. Unit Tests

Every service must have unit tests with >= 80% coverage. This section covers the testing patterns, file structure, and templates.

### 10.1 Test File Structure

```
apps/<service>/src/
├── <service>.service.spec.ts          # Service business logic tests
├── <service>.controller.spec.ts       # Controller delegation tests
├── prisma.service.spec.ts             # (optional, trivial)
├── dto/
│   └── (no tests needed — validated by class-validator at runtime)
└── <submodule>/
    ├── <submodule>.service.spec.ts
    └── <submodule>.controller.spec.ts
```

### 10.2 Jest Configuration

Already configured in root `package.json`:

```json
{
  "jest": {
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "testEnvironment": "node",
    "roots": ["<rootDir>/libs/", "<rootDir>/apps/"],
    "moduleNameMapper": {
      "^@app/common(|/.*)$": "<rootDir>/libs/common/src/$1"
    }
  }
}
```

**Commands:**

```bash
# Run tests for one service
pnpm test -- --testPathPattern products

# Run with coverage for one service
pnpm test:cov -- --testPathPattern products

# Run all tests
pnpm test

# Run all tests with coverage
pnpm test:cov
```

### 10.3 Service Test Template (with Prisma)

This is the standard pattern for testing a service that uses PrismaService:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MyService } from './<service>.service';
import { PrismaService } from './prisma.service';

describe('MyService', () => {
  let service: MyService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = { id: 1, email: 'test@test.com', password: 'hashed', roles: ['Admin'] };
  const mockEntity = { id: 1, name: 'Test', userId: 1, createdAt: new Date(), updatedAt: new Date() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: PrismaService,
          useValue: {
            entity: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('should create an entity and assign userId', async () => {
      const dto = { name: 'New Item' };
      prisma.entity.create.mockResolvedValue({ ...mockEntity, ...dto });

      const result = await service.create(dto, mockUser);

      expect(prisma.entity.create).toHaveBeenCalledWith({
        data: { ...dto, userId: mockUser.id },
      });
      expect(result.name).toBe('New Item');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      prisma.entity.findMany.mockResolvedValue([mockEntity]);
      prisma.entity.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('should apply pagination offset', async () => {
      prisma.entity.findMany.mockResolvedValue([]);
      prisma.entity.count.mockResolvedValue(0);

      await service.findAll({ page: 3, limit: 10 });

      expect(prisma.entity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return entity by id', async () => {
      prisma.entity.findUnique.mockResolvedValue(mockEntity);

      const result = await service.findOne(1);

      expect(result).toEqual(mockEntity);
    });

    it('should throw NotFoundException when entity does not exist', async () => {
      prisma.entity.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an existing entity', async () => {
      prisma.entity.findUnique.mockResolvedValue(mockEntity);
      prisma.entity.update.mockResolvedValue({ ...mockEntity, name: 'Updated' });

      const result = await service.update(1, { name: 'Updated' }, mockUser);

      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      prisma.entity.findUnique.mockResolvedValue({ ...mockEntity, userId: 999 });
      const nonOwner = { ...mockUser, id: 2, roles: [] };

      await expect(service.update(1, { name: 'X' }, nonOwner)).rejects.toThrow(ForbiddenException);
    });

    it('should allow Admin to update any entity', async () => {
      prisma.entity.findUnique.mockResolvedValue({ ...mockEntity, userId: 999 });
      prisma.entity.update.mockResolvedValue({ ...mockEntity, name: 'Admin Update' });

      const result = await service.update(1, { name: 'Admin Update' }, mockUser);

      expect(result.name).toBe('Admin Update');
    });
  });

  describe('remove', () => {
    it('should soft-delete entity', async () => {
      prisma.entity.findUnique.mockResolvedValue(mockEntity);
      prisma.entity.update.mockResolvedValue({ ...mockEntity, deletedAt: new Date() });

      const result = await service.remove(1, mockUser);

      expect(prisma.entity.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
```

### 10.4 Controller Test Template

Controllers are thin — tests verify they delegate to the service correctly:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyController } from './<service>.controller';
import { MyService } from './<service>.service';

describe('MyController', () => {
  let controller: MyController;
  let service: jest.Mocked<MyService>;

  const mockUser = { id: 1, email: 'test@test.com', password: 'hashed', roles: ['Admin'] };
  const mockEntity = { id: 1, name: 'Test', userId: 1 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyController],
      providers: [
        {
          provide: MyService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MyController>(MyController);
    service = module.get(MyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with dto and user', async () => {
      const dto = { name: 'New Item' };
      service.create.mockResolvedValue(mockEntity as any);

      const result = await controller.create(dto as any, mockUser);

      expect(service.create).toHaveBeenCalledWith(dto, mockUser);
      expect(result).toEqual(mockEntity);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with query params', async () => {
      const query = { page: 1, limit: 20 };
      const paginated = { data: [mockEntity], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } };
      service.findAll.mockResolvedValue(paginated as any);

      const result = await controller.findAll(query as any);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should convert string id to number and call service', async () => {
      service.findOne.mockResolvedValue(mockEntity as any);

      await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('should call service.update with id, dto, and user', async () => {
      const dto = { name: 'Updated' };
      service.update.mockResolvedValue({ ...mockEntity, ...dto } as any);

      await controller.update('1', dto as any, mockUser);

      expect(service.update).toHaveBeenCalledWith(1, dto, mockUser);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and user', async () => {
      service.remove.mockResolvedValue(mockEntity as any);

      await controller.remove('1', mockUser);

      expect(service.remove).toHaveBeenCalledWith(1, mockUser);
    });
  });
});
```

### 10.5 Service Test with Microservice Clients

When a service calls other services via `ClientProxy`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { PAYMENTS_SERVICE, PRODUCTS_SERVICE, NOTIFICATIONS_SERVICE } from '@app/common';
import { OrdersService } from './orders.service';
import { PrismaService } from './prisma.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: jest.Mocked<PrismaService>;
  let paymentsClient: jest.Mocked<ClientProxy>;
  let productsClient: jest.Mocked<ClientProxy>;
  let notificationsClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: PAYMENTS_SERVICE,
          useValue: { send: jest.fn(), emit: jest.fn(), connect: jest.fn() },
        },
        {
          provide: PRODUCTS_SERVICE,
          useValue: { send: jest.fn(), emit: jest.fn(), connect: jest.fn() },
        },
        {
          provide: NOTIFICATIONS_SERVICE,
          useValue: { send: jest.fn(), emit: jest.fn(), connect: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get(PrismaService);
    paymentsClient = module.get(PAYMENTS_SERVICE);
    productsClient = module.get(PRODUCTS_SERVICE);
    notificationsClient = module.get(NOTIFICATIONS_SERVICE);
  });

  describe('create', () => {
    it('should verify product stock before creating order', async () => {
      productsClient.send.mockReturnValue(of({ id: 1, available: true, price: 100 }));
      prisma.order.create.mockResolvedValue({ id: 1, totalAmount: 100 } as any);

      const dto = { items: [{ productId: 1, quantity: 1, unitPrice: 100 }] };
      await service.create(dto as any, { id: 1, email: 'a@b.com' } as any);

      expect(productsClient.send).toHaveBeenCalledWith('product.check_stock', { id: 1 });
    });

    it('should throw when product is not available', async () => {
      productsClient.send.mockReturnValue(of({ id: 1, available: false }));

      const dto = { items: [{ productId: 1, quantity: 1, unitPrice: 100 }] };

      await expect(
        service.create(dto as any, { id: 1, email: 'a@b.com' } as any),
      ).rejects.toThrow();
    });
  });

  describe('checkout', () => {
    it('should send charge to payments service', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 1, userId: 1, status: 'PENDING', totalAmount: 500, items: [],
      } as any);
      prisma.order.update.mockResolvedValue({ id: 1, status: 'PAID', items: [] } as any);
      paymentsClient.send.mockReturnValue(of({ id: 'pi_123' }));

      const checkoutDto = { charge: { card: { number: '4242...', cvc: '123', exp_month: 12, exp_year: 2027 }, amount: 500 } };
      await service.checkout(1, checkoutDto as any, { id: 1, email: 'a@b.com' } as any);

      expect(paymentsClient.send).toHaveBeenCalledWith(
        'create_charge',
        expect.objectContaining({ email: 'a@b.com', amount: 500 }),
      );
    });
  });
});
```

### 10.6 Service Test without Database (e.g., Media)

When a service has no Prisma — mock external clients directly:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { MediaService } from './media.service';

// Mock the minio module
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue(undefined),
    presignedGetObject: jest.fn().mockResolvedValue('https://signed-url.example.com/file.jpg'),
    removeObject: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                MINIO_ENDPOINT: 'localhost',
                MINIO_PORT: 9000,
                MINIO_ACCESS_KEY: 'minioadmin',
                MINIO_SECRET_KEY: 'minioadmin123',
                MINIO_BUCKET: 'test-bucket',
                MINIO_USE_SSL: 'false',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  describe('upload', () => {
    const validFile = {
      buffer: Buffer.from('test'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
    } as Express.Multer.File;

    it('should upload a valid file and return key + url', async () => {
      const result = await service.upload(validFile);

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('url');
      expect(result.key).toMatch(/\.jpg$/);
    });

    it('should throw BadRequestException when file is null', async () => {
      await expect(service.upload(null)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for oversized files', async () => {
      const bigFile = { ...validFile, size: 20 * 1024 * 1024 };

      await expect(service.upload(bigFile as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for disallowed MIME types', async () => {
      const exeFile = { ...validFile, mimetype: 'application/x-executable' };

      await expect(service.upload(exeFile as any)).rejects.toThrow(BadRequestException);
    });

    it('should place file in folder when folder is specified', async () => {
      const result = await service.upload(validFile, 'products');

      expect(result.key).toMatch(/^products\//);
    });
  });

  describe('getSignedUrl', () => {
    it('should return a presigned URL', async () => {
      const url = await service.getSignedUrl('some-key.jpg');

      expect(url).toBe('https://signed-url.example.com/file.jpg');
    });
  });

  describe('delete', () => {
    it('should delete without throwing', async () => {
      await expect(service.delete('some-key.jpg')).resolves.not.toThrow();
    });
  });
});
```

### 10.7 What to Test vs. What to Skip

#### Always test:

| What | Why |
|------|-----|
| Service CRUD methods | Core business logic |
| Pagination math (skip/take, totalPages) | Easy to get wrong |
| Authorization checks (owner only, Admin role) | Security-critical |
| Error cases (NotFoundException, ForbiddenException) | Guard against regressions |
| Input validation side effects (e.g., soft delete sets `deletedAt`) | Ensures correct data mutations |
| Inter-service calls (correct pattern name, correct payload) | Contract verification |
| File validation (size, type) | Security boundary |

#### Don't test:

| What | Why |
|------|-----|
| DTOs | Validated by `class-validator` + `ValidationPipe` at runtime |
| `PrismaService` | Trivial constructor, tested via integration |
| `main.ts` bootstrap | Tested by starting the service |
| Third-party library internals | Not your code |
| Decorator metadata (`@Roles`, `@CurrentUser`) | Tested in `libs/common` specs |

### 10.8 Testing Conventions

1. **File naming:** `<name>.spec.ts` next to the file being tested
2. **Describe blocks:** Match the class/method structure
3. **Mock pattern:** Use `jest.Mocked<T>` for type-safe mocks
4. **Provider mocking:** Replace real providers in `Test.createTestingModule({ providers: [...] })`
5. **Assertions:** Use `toHaveBeenCalledWith` for verifying service delegation, `rejects.toThrow` for errors
6. **No DB in unit tests:** Always mock PrismaService — real DB is for integration tests only
7. **No network in unit tests:** Always mock ClientProxy — real services are for E2E tests only

### 10.9 Unit Test Checklist

- [ ] `apps/<service>/src/<service>.service.spec.ts` exists
- [ ] `apps/<service>/src/<service>.controller.spec.ts` exists
- [ ] Submodule specs exist (e.g., `categories.service.spec.ts`)
- [ ] All service methods have at least one happy-path test
- [ ] All error paths are tested (NotFoundException, ForbiddenException, etc.)
- [ ] Authorization logic is tested (owner check, admin bypass)
- [ ] Pagination logic is tested (page/limit/skip/totalPages)
- [ ] Inter-service calls are verified (correct pattern, correct payload)
- [ ] `pnpm test -- --testPathPattern <service>` passes with zero failures
- [ ] `pnpm test:cov -- --testPathPattern <service>` shows >= 80% line coverage
- [ ] Tests do NOT connect to real databases, Redis, or external services

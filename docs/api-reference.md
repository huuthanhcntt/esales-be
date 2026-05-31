# API Reference

All 7 services expose interactive Swagger UI at `/api/docs`. Use Swagger for full endpoint details, request/response schemas, and try-it-out.

## Swagger URLs

| Service | URL | Description |
|---------|-----|-------------|
| Auth | http://localhost:4001/api/docs | User registration, login, JWT authentication |
| Reservations | http://localhost:4000/api/docs | Reservation CRUD with payment integration |
| Products | http://localhost:3005/api/docs | Product catalog, categories, search, WebSocket |
| Orders | http://localhost:3007/api/docs | Order lifecycle, checkout, Stripe webhook |
| Media | http://localhost:3009/api/docs | File upload/download via MinIO/S3 |
| Payments | http://localhost:3013/api/docs | Stripe payment processing |
| Notifications | http://localhost:3014/api/docs | Email notification delivery |

---

## Service Overview

### Auth (:4001)

User management and JWT authentication. Issues HTTP-only cookies on login.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/users` | No | Register user |
| `POST` | `/auth/login` | No | Login (returns JWT cookie) |
| `GET` | `/users` | JWT | Get current user profile |

### Reservations (:4000)

Hotel/venue booking with integrated payment flow.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/reservations` | JWT | Create reservation + charge |
| `GET` | `/reservations` | JWT | List all |
| `GET/PATCH/DELETE` | `/reservations/:id` | JWT | Get/update/delete (delete = Admin) |

### Products (:3005)

Product catalog management with categories and WebSocket updates.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/products` | JWT | Create product |
| `GET` | `/products` | No | List (paginated, search, filter by category/status/price) |
| `GET/PATCH/DELETE` | `/products/:id` | Mixed | Get (public), update/delete (owner or Admin) |
| `POST` | `/products/categories` | Admin | Create category |
| `GET` | `/products/categories` | No | List category tree |

### Orders (:3007)

Order lifecycle from creation through checkout to delivery.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/orders` | JWT | Create order (validates product stock) |
| `GET` | `/orders` | JWT | List user's orders |
| `POST` | `/orders/:id/checkout` | JWT | Initiate payment |
| `PATCH` | `/orders/:id/cancel` | JWT | Cancel order |
| `GET` | `/orders/admin` | Admin | List all orders |
| `POST` | `/orders/webhook` | No | Stripe webhook |

### Media (:3009)

File upload and object storage management via MinIO (dev) / S3 (prod).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/media/upload` | JWT | Upload file (multipart/form-data) |
| `GET` | `/media/:key` | No | Get signed download URL |
| `DELETE` | `/media/:key` | JWT | Delete file |

---

## Authentication

All protected endpoints accept JWT via:
1. Cookie: `Authentication=<jwt>` (set by `POST /auth/login`)
2. Header: `Authentication: <jwt>`

### Role-Based Access

- `@Roles('Admin')` — coarse-grained role check
- `@Permissions('module:action')` — fine-grained per-module access (e.g. `products:create`)
- Admin role bypasses all permission checks

---

## Inter-Service Communication (RPC)

Services communicate via TCP (default) or Kafka (when `KAFKA_BROKER` is set).

| Pattern | Direction | Type | Purpose |
|---------|-----------|------|---------|
| `authenticate` | * -> Auth | Request/Response | JWT validation |
| `create_charge` | * -> Payments | Request/Response | Process payment |
| `notify_email` | * -> Notifications | Fire-and-forget | Send email |
| `product.get` | Orders -> Products | Request/Response | Get product details |
| `product.check_stock` | Orders -> Products | Request/Response | Verify availability |
| `product.mark_sold` | Orders -> Products | Fire-and-forget | Mark product sold |
| `media.upload` | * -> Media | Request/Response | Upload file via RPC |
| `media.delete` | * -> Media | Request/Response | Delete file via RPC |
| `media.get_url` | * -> Media | Request/Response | Get signed URL |

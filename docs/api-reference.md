# API Reference

## Auth Service (host port 4001)

### Register User

```http
POST /users
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "roles": ["Admin"]          // optional
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "email": "user@example.com"
}
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

**Response:** `200 OK` + `Set-Cookie: Authentication=<jwt>; HttpOnly`

### Get Current User

```http
GET /users
Cookie: Authentication=<jwt>
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "roles": ["Admin"]
}
```

---

## Reservations Service (host port 4000)

All endpoints require JWT authentication via cookie.

### Create Reservation

```http
POST /reservations
Cookie: Authentication=<jwt>
Content-Type: application/json

{
  "startDate": "2024-02-01",
  "endDate": "2024-02-05",
  "charge": {
    "amount": 100,
    "card": {
      "cvc": "413",
      "exp_month": 12,
      "exp_year": 2027,
      "number": "4242424242424242"
    }
  }
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "startDate": "2024-02-01T00:00:00.000Z",
  "endDate": "2024-02-05T00:00:00.000Z",
  "userId": 1,
  "invoiceId": "pi_3M...",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### List All Reservations

```http
GET /reservations
Cookie: Authentication=<jwt>
```

### Get Single Reservation

```http
GET /reservations/:id
Cookie: Authentication=<jwt>
```

### Update Reservation

```http
PATCH /reservations/:id
Cookie: Authentication=<jwt>
Content-Type: application/json

{
  "startDate": "2024-03-01"
}
```

### Delete Reservation (Admin only)

```http
DELETE /reservations/:id
Cookie: Authentication=<jwt>
```

Requires `@Roles('Admin')` — returns `403 Forbidden` if the user does not have the `Admin` role.

---

## Data Transfer Objects (DTOs)

### Common DTOs

```typescript
// CardDto
{
  cvc:       string   // @IsString, @IsNotEmpty
  exp_month: number   // @IsNumber
  exp_year:  number   // @IsNumber
  number:    string   // @IsCreditCard
}

// CreateChargeDto
{
  card:   CardDto     // @ValidateNested, @Type(() => CardDto)
  amount: number      // @IsNumber
}

// User (interface)
{
  id:       number
  email:    string
  password: string
  roles:    string[]
}
```

### Auth DTOs

```typescript
// CreateUserDto
{
  email:    string    // @IsEmail
  password: string    // @IsStrongPassword
  roles?:   string[]  // @IsOptional, @IsArray, @IsString({ each: true })
}

// GetUserDto
{
  id:       string    // @IsString, @IsNotEmpty
}
```

### Reservations DTOs

```typescript
// CreateReservationDto
{
  startDate: Date             // @IsDate, @Type(() => Date)
  endDate:   Date             // @IsDate, @Type(() => Date)
  charge:    CreateChargeDto  // @ValidateNested, @Type(() => CreateChargeDto)
}

// UpdateReservationDto — PartialType(CreateReservationDto)
// All fields optional
```

### Payments DTOs

```typescript
// PaymentsCreateChargeDto extends CreateChargeDto
{
  card:   CardDto   // inherited
  amount: number    // inherited
  email:  string    // @IsEmail (added)
}
```

### Notifications DTOs

```typescript
// NotifyEmailDto
{
  email: string   // @IsEmail
  text:  string   // @IsString
}
```

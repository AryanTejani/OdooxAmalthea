# PERN Authentication Server

Production-ready authentication server with JWT (access + rotating refresh tokens), argon2id password hashing, Google OAuth (OIDC with PKCE), and comprehensive security features.

## 🎯 Features

- **Email/Password Authentication** with secure argon2id hashing
- **JWT Tokens**: Access (15m) + Rotating Refresh (7d) stored in httpOnly cookies
- **Google OAuth 2.0** (OIDC with PKCE flow)
- **Refresh tokens hashed in database** for maximum security
- **Rate limiting** on authentication endpoints
- **Comprehensive security**: Helmet, CORS, SameSite cookies
- **Type-safe** with TypeScript
- **Database**: PostgreSQL with raw SQL (pg library)
- **Logging**: Structured logging with Pino

## 📋 Prerequisites

- **Node.js** 20+ 
- **PostgreSQL** 16+ running locally
- **npm** or **yarn**

## 🚀 Quick Start

### 1. Database Setup

Create the PostgreSQL database:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE appdb;"

# Or using pgAdmin or any PostgreSQL GUI
```

### 2. Install Dependencies

```bash
cd server
npm install
```

### 3. Environment Variables

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` and set the following:

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Database (adjust password if needed)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb

# Generate strong secrets (32+ characters):
# openssl rand -base64 32
JWT_ACCESS_SECRET=your_access_secret_min_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_min_32_characters

# Google OAuth Credentials (see below)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Frontend URL for OAuth redirect
OAUTH_ALLOWED_REDIRECTS=http://localhost:5173
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
7. Copy **Client ID** and **Client Secret** to `.env`

### 5. Database Migration

Run SQL migrations:

```bash
npm run migrate
```

This will execute all SQL migration files from `db/migrations/` directory in order.

### 6. Seed Database

Create an admin user:

```bash
npm run seed
```

Default admin credentials:
- **Email**: `admin@example.com`
- **Password**: `Admin123!`

### 7. Start Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

Server will start at: `http://localhost:3000`

## 📚 API Documentation

### Base URL

```
http://localhost:3000
```

### Authentication

All authenticated endpoints require an `access_token` cookie. Tokens are automatically set via httpOnly cookies.

---

## 🔐 Endpoints

### Health Check

**GET** `/healthz`

Check server and database health.

**Response**
```json
{
  "status": "ok",
  "db": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### Register

**POST** `/api/auth/register`

Register a new user with email and password.

**Request Body**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecurePass123!"
}
```

**Password Requirements**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Response** (201 Created)
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Cookies Set**
- `access_token` (httpOnly, 15 minutes)
- `refresh_token` (httpOnly, 7 days)

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "TestPass123!"
  }' \
  -c cookies.txt
```

---

### Login

**POST** `/api/auth/login`

Login with email and password.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK)
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }' \
  -c cookies.txt
```

---

### Refresh Token

**POST** `/api/auth/refresh`

Rotate refresh token and get new access token.

**Request**
- Requires `refresh_token` cookie

**Response** (200 OK)
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Behavior**
- Verifies current refresh token
- Revokes old session
- Creates new session with new tokens
- Returns new `access_token` and `refresh_token` cookies

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

---

### Logout

**POST** `/api/auth/logout`

Logout and revoke session.

**Response** (200 OK)
```json
{
  "message": "Logged out successfully"
}
```

**Behavior**
- Revokes current session in database
- Clears `access_token` and `refresh_token` cookies

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

---

### Get Current User

**GET** `/api/auth/me`

Get current authenticated user.

**Request**
- Requires `access_token` cookie

**Response** (200 OK)
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**cURL Example**
```bash
curl http://localhost:3000/api/auth/me \
  -b cookies.txt
```

---

### Google OAuth Login

**GET** `/api/auth/google`

Initiate Google OAuth flow.

**Behavior**
1. Generates PKCE code verifier and challenge
2. Generates state token
3. Stores both in httpOnly cookies (10 minutes)
4. Redirects to Google authorization page

**Browser Example**
```
http://localhost:3000/api/auth/google
```

---

### Google OAuth Callback

**GET** `/api/auth/google/callback`

Google OAuth callback handler (handled automatically).

**Behavior**
1. Validates state parameter
2. Exchanges authorization code for tokens using PKCE
3. Gets user info from Google
4. Finds or creates user account:
   - If OAuth account exists → login
   - If email exists → link account
   - Otherwise → create new user
5. Creates session with hashed refresh token
6. Sets `access_token` and `refresh_token` cookies
7. Redirects to frontend `/profile`

---

## 🔒 Security Features

### Password Hashing
- **Algorithm**: argon2id
- **Memory**: 64 MB
- **Time cost**: 3 iterations
- **Parallelism**: 4 threads

### Refresh Token Storage
- Tokens are **hashed with argon2id** before database storage
- Never store raw tokens in database
- Rotation on every refresh (old token revoked)

### Cookies
- **httpOnly**: JavaScript cannot access
- **SameSite**: Lax (CSRF protection)
- **Secure**: Production only (HTTPS)
- **Path**: `/` (all routes)

### Rate Limiting
- **Auth endpoints** (`/login`, `/register`): 10 requests/minute per IP
- **OAuth endpoints**: 5 requests/5 minutes per IP
- **General API**: 100 requests/15 minutes per IP

### CORS
- Single origin from `CORS_ORIGIN` env variable
- Credentials: enabled
- No wildcard origins

### Error Handling
- Generic error messages (no email enumeration)
- Structured error format: `{ error: { code, message } }`
- Full error logging with request IDs

---

## 🧪 Testing the Auth Flow

### Complete Flow Test

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","password":"Test123!@"}' \
  -c cookies.txt -v

# 2. Get current user (should work)
curl http://localhost:3000/api/auth/me -b cookies.txt

# 3. Wait 15+ minutes for access token to expire, then refresh
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt -c cookies.txt

# 4. Verify still authenticated
curl http://localhost:3000/api/auth/me -b cookies.txt

# 5. Logout
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt

# 6. Try to access protected route (should fail)
curl http://localhost:3000/api/auth/me -b cookies.txt
```

---

## 📁 Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── env.ts           # Environment validation
│   │   └── logger.ts        # Pino logger setup
│   ├── db/
│   │   ├── migrate.ts       # Migration runner
│   │   └── seed.ts          # Database seeding
│   ├── libs/
│   │   ├── db.ts            # PostgreSQL Pool and query functions
│   │   └── pg.ts            # PostgreSQL client for LISTEN/NOTIFY
│   ├── middleware/
│   │   ├── auth.ts          # Authentication middleware
│   │   ├── cors.ts          # CORS configuration
│   │   ├── errors.ts        # Error handling
│   │   └── rateLimit.ts     # Rate limiting
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.repo.ts # Raw SQL repository
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.schemas.ts
│   │   │   └── auth.service.ts
│   │   ├── oauth/
│   │   │   ├── google.client.ts
│   │   │   ├── google.routes.ts
│   │   │   ├── google.service.ts
│   │   │   └── oauth.repo.ts # Raw SQL repository
│   │   └── user/
│   │       ├── user.repo.ts  # Re-exports from auth.repo
│   │       └── user.types.ts
│   ├── utils/
│   │   ├── cookies.ts       # Cookie helpers
│   │   ├── crypto.ts        # Argon2 hashing
│   │   ├── jwt.ts           # JWT signing/verification
│   │   └── sql.ts           # SQL template helper (optional)
│   ├── app.ts               # Express app setup
│   └── index.ts             # Server entry point
├── db/
│   └── migrations/
│       ├── 000_init.sql              # Initial schema
│       ├── 001_realtime_triggers.sql # Real-time triggers
│       └── 002_sample_indexes.sql    # Additional indexes
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 🛠️ Development

### Available Scripts

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run SQL migrations
npm run migrate

# Rollback last migration (basic support)
npm run migrate:down

# Seed database
npm run seed
```

### Database Management

```bash
# Create a new migration
# Create a new .sql file in db/migrations/ with appropriate numbering
# Example: 003_add_new_feature.sql

# Run migrations
npm run migrate

# Manual database access
psql -U postgres -d appdb
```

---

## 🚨 Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `EMAIL_EXISTS` | 409 | Email already registered |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `UNAUTHORIZED` | 401 | Authentication required |
| `ACCESS_TOKEN_EXPIRED` | 401 | Access token expired (refresh needed) |
| `INVALID_REFRESH_TOKEN` | 401 | Invalid refresh token |
| `SESSION_EXPIRED` | 401 | Session expired |
| `SESSION_REVOKED` | 401 | Session revoked |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected error |

---

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `3000` | Server port |
| `CORS_ORIGIN` | Yes | - | Frontend URL for CORS |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | - | Secret for access tokens (32+ chars) |
| `JWT_REFRESH_SECRET` | Yes | - | Secret for refresh tokens (32+ chars) |
| `GOOGLE_CLIENT_ID` | Yes | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | - | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | - | OAuth callback URL |
| `OAUTH_ALLOWED_REDIRECTS` | Yes | - | Comma-separated frontend URLs |

---

## 📄 License

MIT

---

## 👥 Support

For issues or questions, please open an issue on GitHub.


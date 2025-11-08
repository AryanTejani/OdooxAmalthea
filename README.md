# PERN Authentication System

Production-ready, hackathon-ready authentication system built with PostgreSQL, Express, React, and Node.js (PERN stack).

## 🎯 Overview

A complete, secure authentication system featuring:

- **Backend**: Node.js 20+ with TypeScript, Express, Prisma ORM
- **Database**: PostgreSQL 16+ (local, no Docker)
- **Frontend**: React 18 with TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Authentication**: JWT access/refresh tokens in httpOnly cookies
- **OAuth**: Google Sign-In with OIDC and PKCE
- **Security**: argon2id hashing, refresh token rotation, rate limiting

## ✨ Key Features

### Security First
- ✅ **argon2id** password hashing (memory-hard, secure)
- ✅ **Refresh tokens hashed** in database (never store raw tokens)
- ✅ **httpOnly cookies** (JavaScript cannot access tokens)
- ✅ **SameSite=Lax** cookies (CSRF protection)
- ✅ **Token rotation** (refresh tokens rotate on use)
- ✅ **Rate limiting** on auth endpoints
- ✅ **Helmet** security headers
- ✅ **CORS** with single origin, credentials enabled

### Modern Stack
- ✅ **TypeScript** throughout (type-safe)
- ✅ **Prisma ORM** with migrations
- ✅ **Zod** validation (backend + frontend)
- ✅ **React Hook Form** for forms
- ✅ **TanStack Query** for data fetching
- ✅ **Pino** structured logging
- ✅ **shadcn/ui** components

### Developer Experience
- ✅ Hot reload in development
- ✅ Comprehensive error handling
- ✅ Type-safe API client
- ✅ Automatic token refresh
- ✅ Protected routes
- ✅ Toast notifications
- ✅ Clean, modular code

## 📋 Prerequisites

- **Node.js** 20 or higher
- **PostgreSQL** 16 or higher (running locally)
- **npm** or **yarn**

## 🚀 Quick Start

### 1. Clone/Extract Project

```bash
cd hackathon
```

### 2. Setup Database

Create PostgreSQL database:

```bash
psql -U postgres -c "CREATE DATABASE appdb;"
```

### 3. Backend Setup

```bash
cd server

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit .env and set:
# - JWT_ACCESS_SECRET (generate: openssl rand -base64 32)
# - JWT_REFRESH_SECRET (generate: openssl rand -base64 32)
# - GOOGLE_CLIENT_ID (from Google Cloud Console)
# - GOOGLE_CLIENT_SECRET (from Google Cloud Console)

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database (creates admin@example.com / Admin123!)
npm run seed

# Start server
npm run dev
```

Server runs at: **http://localhost:3000**

### 4. Frontend Setup

```bash
cd ../client

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

## 🔐 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project (or select existing)
3. Enable **Google+ API**
4. **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. **Authorized redirect URIs**: `http://localhost:3000/api/auth/google/callback`
7. Copy **Client ID** and **Client Secret** to `server/.env`

## 📚 Documentation

- **[Server README](./server/README.md)** - Backend API documentation, endpoints, architecture
- **[Client README](./client/README.md)** - Frontend structure, components, styling

## 🧪 Testing the System

### 1. Register New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "Test123!@"
  }' \
  -c cookies.txt
```

### 2. Check Authentication

```bash
curl http://localhost:3000/api/auth/me -b cookies.txt
```

### 3. Login (Admin User)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }' \
  -c cookies.txt
```

### 4. Refresh Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt -c cookies.txt
```

### 5. Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

### 6. Browser Flow

1. Open: http://localhost:5173
2. Click **Sign up** → Register account → Auto-login to Profile
3. Click **Logout** → Redirected to Login
4. Click **Continue with Google** → OAuth flow → Profile
5. Profile page shows user info and authentication status

## 🏗️ Architecture

### Backend Structure

```
server/src/
├── config/          # Environment, logger setup
├── libs/            # Prisma client
├── middleware/      # Auth, CORS, rate limit, errors
├── modules/
│   ├── auth/        # Registration, login, refresh, logout
│   ├── oauth/       # Google OIDC with PKCE
│   └── user/        # User repository and types
├── utils/           # Crypto (argon2), JWT, cookies
├── app.ts           # Express app
└── index.ts         # Server entry point
```

### Frontend Structure

```
client/src/
├── auth/            # AuthContext, ProtectedRoute
├── components/
│   ├── ui/          # shadcn/ui components
│   └── GoogleButton.tsx
├── lib/             # API client, utils
├── pages/           # Login, Register, Profile
├── App.tsx          # Routing
└── main.tsx         # Entry point
```

## 🔒 Security Implementation

### Password Security
- **argon2id** (memory cost: 64MB, time: 3, parallelism: 4)
- Never stored in plain text
- Generic error messages (no email enumeration)

### Token Management
- **Access token**: 15 minutes, signed JWT
- **Refresh token**: 7 days, signed JWT, **hashed in DB**
- Rotation: old refresh token revoked on use
- Stored in **httpOnly** cookies only

### Session Security
- Session tied to User-Agent and IP
- Revocation on logout
- Expiry tracked in database
- Failed refresh = session revoked

### OAuth Security
- **PKCE** (Proof Key for Code Exchange)
- State parameter validation
- Transient cookies (10 min expiry)
- Account linking by email

## 📊 Database Schema

### User
- `id` (UUID), `email` (unique), `name`, `passwordHash`, `role`, timestamps

### Session
- `id`, `userId`, `refreshTokenHash`, `userAgent`, `ip`, `expiresAt`, `revokedAt`

### Account
- `id`, `userId`, `provider` ('google'), `providerAccountId` (Google sub), `email`, `profile` (JSON)

## 🛠️ Development Commands

### Backend
```bash
npm run dev        # Development with hot reload
npm run build      # Build TypeScript
npm start          # Production mode
npm run migrate    # Run Prisma migrations
npm run seed       # Seed database
```

### Frontend
```bash
npm run dev        # Development with hot reload
npm run build      # Production build
npm run preview    # Preview production build
```

## 🚨 Environment Variables

### Server (`server/.env`)
```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb?schema=public
JWT_ACCESS_SECRET=<generate-32-chars>
JWT_REFRESH_SECRET=<generate-32-chars>
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
OAUTH_ALLOWED_REDIRECTS=http://localhost:5173
```

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:3000
```

## 🎨 Design & UX

- **Primary color**: Violet (`hsl(262.1, 83.3%, 57.8%)`)
- **Responsive**: Mobile-first design
- **Accessibility**: Semantic HTML, proper labels
- **Loading states**: Spinners and disabled states
- **Error handling**: Toast notifications (Sonner)
- **Smooth transitions**: Tailwind animations

## 📈 Production Considerations

### Backend
- Set `NODE_ENV=production`
- Use strong JWT secrets (64+ chars)
- Configure PostgreSQL for production
- Enable HTTPS (Secure cookie flag)
- Set up monitoring (Pino logs)
- Rate limiting tuned for traffic
- Database connection pooling

### Frontend
- Build with `npm run build`
- Serve static files via CDN or nginx
- Set correct `VITE_API_URL`
- Enable HTTPS
- Configure CSP headers

## 🐛 Common Issues

### Database Connection Failed
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in `.env`
- Ensure database exists: `psql -U postgres -c "\l"`

### CORS Errors
- Verify `CORS_ORIGIN` matches frontend URL exactly
- Check `withCredentials: true` in axios

### OAuth Not Working
- Verify Google Cloud Console redirect URI matches exactly
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Ensure `OAUTH_ALLOWED_REDIRECTS` includes frontend URL

### Cookies Not Set
- Check backend and frontend on same domain (localhost OK)
- In production, use same domain or configure properly
- Verify `credentials: true` in CORS

## 📄 License

MIT

## 🙏 Acknowledgments

Built with modern best practices for hackathons and production use.

- **argon2** for password hashing
- **openid-client** for OAuth
- **Prisma** for database ORM
- **shadcn/ui** for UI components
- **Vite** for fast development

---

**Ready for deployment. Ready for demo. Ready to win.** 🏆


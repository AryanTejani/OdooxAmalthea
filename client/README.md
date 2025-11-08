# PERN Authentication Client

Modern React frontend with TypeScript, Tailwind CSS, and shadcn/ui components for the PERN authentication system.

## 🎯 Features

- **Modern UI** with Tailwind CSS and shadcn/ui components
- **Type-safe** with TypeScript
- **Form validation** with React Hook Form + Zod
- **Smart token refresh** with axios interceptors
- **Google OAuth** integration
- **Toast notifications** with Sonner
- **Protected routes** with React Router
- **Silent token refresh** every 10 minutes

## 📋 Prerequisites

- **Node.js** 20+
- **npm** or **yarn**
- Backend server running at `http://localhost:3000`

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd client
npm install
```

### 2. Environment Setup

The `.env` file is already configured with default values:

```env
VITE_API_URL=http://localhost:3000
```

Modify if your backend runs on a different URL.

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at: `http://localhost:5173`

## 📁 Project Structure

```
client/
├── src/
│   ├── auth/
│   │   ├── AuthContext.tsx       # Authentication context & state
│   │   └── ProtectedRoute.tsx    # Route protection wrapper
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   └── card.tsx
│   │   └── GoogleButton.tsx      # Google OAuth button
│   ├── lib/
│   │   ├── api.ts                # Axios instance & API methods
│   │   ├── queryClient.ts        # TanStack Query config
│   │   └── utils.ts              # Utility functions
│   ├── pages/
│   │   ├── Login.tsx             # Login page
│   │   ├── Register.tsx          # Registration page
│   │   └── Profile.tsx           # Protected profile page
│   ├── App.tsx                   # Main app with routing
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles & Tailwind
├── index.html
├── vite.config.ts
├── tailwind.config.cjs
└── package.json
```

## 🎨 Pages

### Login (`/login`)

- Email/password authentication
- Google OAuth button
- Link to registration
- Form validation with Zod

### Register (`/register`)

- Create new account
- Password strength validation
- Google OAuth option
- Auto-login after registration

### Profile (`/profile`) - Protected

- Display user information
- Logout functionality
- Protected by authentication

## 🔐 Authentication Flow

### Email/Password Authentication

1. User enters credentials on Login/Register page
2. Form validation with Zod
3. API call to backend (`/api/auth/login` or `/api/auth/register`)
4. Backend sets httpOnly cookies (`access_token`, `refresh_token`)
5. User redirected to Profile page
6. AuthContext loads user data via `/api/auth/me`

### Google OAuth Flow

1. User clicks "Continue with Google"
2. Redirected to backend OAuth endpoint (`/api/auth/google`)
3. Backend redirects to Google authorization
4. User authorizes app
5. Google redirects back to backend callback
6. Backend creates/links account and sets cookies
7. User redirected to frontend `/profile`
8. AuthContext loads user data

### Token Refresh

#### Automatic Refresh (Interceptor)

- When API returns 401 Unauthorized
- Axios interceptor calls `/api/auth/refresh`
- New tokens set via cookies
- Original request retried automatically

#### Silent Refresh (Timer)

- Every 10 minutes while user is logged in
- Calls `/api/auth/refresh` in background
- Keeps session alive without interruption

## 🛠️ Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎨 Styling

### Tailwind CSS

Configuration uses violet as the primary color theme. Modify `tailwind.config.cjs` to customize:

```js
theme: {
  extend: {
    colors: {
      primary: { DEFAULT: 'hsl(var(--primary))' },
      // ... other colors
    }
  }
}
```

### CSS Variables

Located in `src/index.css`:

```css
:root {
  --primary: 262.1 83.3% 57.8%;  /* Violet */
  --background: 0 0% 100%;        /* White */
  /* ... other variables */
}
```

## 🔌 API Integration

### API Client (`src/lib/api.ts`)

Configured axios instance with:
- Base URL from environment
- Credentials (cookies) enabled
- Automatic token refresh on 401
- Type-safe API methods

### Usage Example

```typescript
import { authApi } from '@/lib/api';

// Login
const user = await authApi.login({ email, password });

// Get current user
const currentUser = await authApi.getMe();

// Logout
await authApi.logout();
```

## 🔒 Security Features

### Cookie-based Authentication
- Tokens stored in httpOnly cookies (no localStorage/sessionStorage)
- JavaScript cannot access tokens (XSS protection)
- SameSite=Lax (CSRF protection)

### Protected Routes
- `ProtectedRoute` wrapper checks authentication
- Redirects to `/login` if not authenticated
- Shows loading state while checking auth

### Automatic Token Management
- Access token (15 min) refreshed automatically
- Refresh token (7 days) rotated on use
- Silent refresh keeps user logged in

## 🐛 Error Handling

### Toast Notifications
Errors displayed via Sonner toast:

```typescript
toast.error('Login failed');
toast.success('Logged in successfully!');
```

### API Errors
Extracted and formatted from axios errors:

```typescript
import { getErrorMessage } from '@/lib/api';

try {
  await authApi.login(data);
} catch (error) {
  const message = getErrorMessage(error);
  toast.error(message);
}
```

## 🚨 Troubleshooting

### CORS Issues

Ensure backend `CORS_ORIGIN` matches frontend URL:

```env
# Backend .env
CORS_ORIGIN=http://localhost:5173
```

### Cookies Not Set

Check:
1. Backend running on correct port
2. `withCredentials: true` in axios config
3. `credentials: true` in backend CORS config

### OAuth Redirect Issues

Verify:
1. Google OAuth redirect URI: `http://localhost:3000/api/auth/google/callback`
2. Backend `OAUTH_ALLOWED_REDIRECTS` includes `http://localhost:5173`

## 📄 License

MIT


# Video Link - https://drive.google.com/drive/folders/1HlvyJt2l7T5UB2gs_pb-p5hCaEqLraw-


# WorkZen - Complete HRMS (Human Resource Management System)

A comprehensive, production-ready Human Resource Management System built with modern web technologies. WorkZen provides a complete solution for managing employees, attendance, leaves, payroll, time tracking, and more, with real-time updates and role-based access control.

## 🎯 Overview

WorkZen is a full-stack HRMS application designed to streamline human resource management for organizations. It features a modern, responsive UI with real-time updates, comprehensive payroll management, attendance tracking, leave management, and more.

## ✨ Key Features

### 🔐 Authentication & Authorization
- **JWT-based authentication** with access and refresh tokens
- **Google OAuth 2.0** integration for seamless login
- **Role-based access control (RBAC)** with four roles: Admin, HR, Payroll Officer, and Employee
- **Secure session management** with rotating refresh tokens
- **First-time login** password setup workflow

### 👥 Employee Management
- Create and manage employees with organizational unit assignments
- Employee profiles with detailed information
- Salary configuration per employee
- Employee status tracking and management

### 📊 Attendance Management
- **Automatic attendance tracking** based on time logs and activity samples
- **Present/Absent/Leave/Half Day** status tracking
- **Monthly attendance views** for employees and admins
- **Daily attendance overview** for HR and Admin
- **Real-time attendance updates** via WebSocket
- Configurable work hours and minimum active hours for present status

### 🏖️ Leave Management
- **Leave request system** with approval workflow
- **Leave types**: Casual, Sick, Unpaid
- **Leave approval workflow**: 
  - Employees submit leave requests
  - HR officers approve/reject employee leaves
  - HR's own leaves go to Admin for approval
  - Payroll officers cannot access leave requests (finance only)
- **Attachment support** for leave requests (uploaded to Cloudinary)
- **Real-time leave status updates**

### 💰 Payroll Management
- **Payrun creation** for monthly payroll processing
- **Automatic payslip generation** based on employee attendance
- **Salary calculations** with:
  - Basic salary and allowances (HRA, etc.)
  - Provident Fund (PF) - Employee and Employer contributions (12% each)
  - Professional Tax (₹200 fixed, applied if Gross >= ₹15,000)
  - Paid leaves included in payable days
  - Unpaid leaves deducted from salary
  - Prorated calculations based on payable days
- **Payrun states**: Draft → Validated → Paid → Cancelled
- **Payslip printing** functionality
- **Payroll dashboard** with employer cost and employee count statistics
- **Monthly payroll statistics** and charts

### 💵 Salary Management
- **Salary configuration** per employee (Basic + Allowances)
- **Role-based salary access**:
  - Admin and Payroll officers can view and edit all employees' salaries
  - HR and Employees can only view their own salary (read-only)
- **Salary breakdown display** with monthly/yearly calculations
- **Automatic PF and Professional Tax calculations**

### ⏱️ Time Tracking
- **Manual time tracking** with task name and description
- **Start/Stop timer** functionality
- **Time log management** with manual entry support
- **Timeline view** of time logs
- **Real-time time log updates**

### 📈 Dashboard
- **Role-based dashboards** with different views for Admin, HR, Payroll, and Employees
- **Key Performance Indicators (KPIs)**:
  - Present today count
  - On leave today (Admin/HR only)
  - Pending leave approvals (Admin/HR only)
  - Total employees
  - Current payrun status
- **Charts and visualizations**:
  - Attendance trends (last 7 days)
  - Leave types breakdown (last 30 days, Admin/HR only)
- **Quick action cards** for common tasks

### 🏢 Company Management
- **Multi-tenant architecture** with company isolation
- **Company profile management** (name, logo)
- **Company code** generation and management

### 🔔 Real-time Updates
- **WebSocket integration** for real-time updates
- **PostgreSQL LISTEN/NOTIFY** for database change notifications
- **Real-time updates for**:
  - Attendance changes
  - Leave request status changes
  - Time log updates
  - Employee status changes

### 📧 Email Notifications
- **Email service integration** (Gmail SMTP)
- **Welcome emails** for new users
- **Login credentials** email for new employees

### ☁️ File Uploads
- **Cloudinary integration** for file storage
- **Leave request attachments** support
- **Company logo uploads**

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router DOM** for routing
- **TanStack Query (React Query)** for data fetching and caching
- **Axios** for HTTP requests
- **Tailwind CSS** for styling
- **Shadcn UI** components
- **Recharts** for data visualization
- **Sonner** for toast notifications
- **React Hook Form** + **Zod** for form validation
- **WebSocket** for real-time updates

### Backend
- **Node.js** with TypeScript
- **Express.js** for REST API
- **PostgreSQL** database
- **JWT** for authentication
- **Argon2** for password hashing
- **WebSocket (ws)** for real-time communication
- **Cloudinary** for file storage
- **Nodemailer** for email services
- **Zod** for schema validation
- **Pino** for logging
- **Helmet** for security
- **CORS** for cross-origin requests

### Database
- **PostgreSQL** with:
  - UUID extensions
  - pgcrypto for encryption
  - pg_trgm for text search
  - pg_stat_statements for query statistics
  - LISTEN/NOTIFY for real-time updates

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ and npm
- **PostgreSQL** 14+ (local or remote)
- **Git** for version control

### Optional but Recommended
- **Google Cloud Console** account for OAuth setup
- **Cloudinary** account for file storage
- **Gmail** account for email notifications

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd odooxamathe
```

### 2. Backend Setup

```bash
cd server
npm install
```

### 3. Database Setup

1. **Create PostgreSQL database**:
```bash
psql -U postgres -c "CREATE DATABASE appdb;"
```

2. **Configure environment variables**:
```bash
cp env.example .env
```

3. **Edit `.env` file** with your configuration (see [Environment Variables](#environment-variables) section)

4. **Run database migrations**:
```bash
npm run migrate
```

5. **(Optional) Seed sample data**:
```bash
npm run seed
```

### 4. Frontend Setup

```bash
cd ../client
npm install
```

### 5. Start Development Servers

**Terminal 1 - Backend**:
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd client
npm run dev
```

### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **WebSocket**: ws://localhost:3000/ws

## 🔧 Environment Variables

### Backend (`server/.env`)

```env
# Server Configuration
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb?schema=public

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
OAUTH_ALLOWED_REDIRECTS=http://localhost:5173

# Attendance Configuration
WORK_HOURS_PER_DAY=8
IDLE_BREAK_THRESHOLD_MIN=15
MIN_ACTIVE_HOURS_PRESENT=5
WORK_WEEK_MON_TO_FRI=true

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Configuration (Gmail SMTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
APP_NAME=WorkZen
APP_URL=http://localhost:5173
```

### Frontend (`client/.env`)

```env
VITE_API_URL=http://localhost:3000
```

## 🗄️ Database Schema

### Core Tables

- **users** - User accounts with authentication
- **sessions** - Refresh token sessions
- **companies** - Multi-tenant company data
- **employees** - Employee records linked to users
- **org_units** - Organizational unit hierarchy
- **attendance** - Daily attendance records
- **leave_requests** - Leave request records
- **salary_config** - Employee salary configurations
- **payruns** - Monthly payroll runs
- **payslips** - Individual employee payslips
- **time_logs** - Time tracking logs
- **activity_samples** - Activity monitoring data

### Database Migrations

Migrations are located in `server/db/migrations/`:

- `000_init.sql` - Initial schema
- `001_realtime_triggers.sql` - Real-time update triggers
- `002_sample_indexes.sql` - Database indexes
- `003_login_id_and_password_change.sql` - Login ID support
- `004_projects_tasks_time_logs.sql` - Time tracking schema
- `005_user_profile_fields.sql` - User profile extensions
- `006_salary_configuration.sql` - Salary configuration schema
- `007_users_role_index.sql` - Role indexing
- `008_activity_samples.sql` - Activity monitoring
- `009_leave_attachment.sql` - Leave attachment support
- `010_multi_tenant.sql` - Multi-tenant support
- `011_payroll_revamp.sql` - Payroll system
- `012_project_task_user_assignments.sql` - Task assignments
- `013_add_task_name_to_time_logs.sql` - Time log task names

## 🔌 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout (revoke refresh token)
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback

### Employee Endpoints

- `GET /api/employees` - Get all employees (Admin/HR/Payroll)
- `POST /api/org/employees` - Create new employee (Admin/HR)
- `GET /api/employees/:id` - Get employee details
- `PATCH /api/employees/:id` - Update employee (Admin/HR)

### Attendance Endpoints

- `GET /api/attendance/me` - Get own attendance (Employee)
- `GET /api/attendance/day` - Get daily attendance (Admin/HR/Payroll)

### Leave Endpoints

- `GET /api/leave` - Get own leave requests (Employee)
- `POST /api/leave` - Create leave request (Employee)
- `GET /api/leave/pending` - Get pending leaves (Admin/HR)
- `POST /api/leave/:id/approve` - Approve leave (Admin/HR)
- `POST /api/leave/:id/reject` - Reject leave (Admin/HR)

### Payroll Endpoints

- `GET /api/payroll/stats` - Get monthly payroll statistics (Admin/Payroll)
- `POST /api/payroll/payruns` - Create payrun (Admin/Payroll)
- `GET /api/payroll/payruns` - Get all payruns (Admin/Payroll)
- `GET /api/payroll/payruns/:id` - Get payrun details (Admin/Payroll)
- `POST /api/payroll/payruns/:id/compute` - Compute payrun (Admin/Payroll)
- `POST /api/payroll/payruns/:id/validate` - Validate payrun (Admin/Payroll)
- `POST /api/payroll/payruns/:id/paid` - Mark payrun as paid (Admin/Payroll)
- `POST /api/payroll/payruns/:id/cancel` - Cancel payrun (Admin/Payroll)
- `GET /api/payroll/payslips/:id` - Get payslip details
- `GET /api/payroll/me/payslips` - Get own payslips (Employee)

### Salary Endpoints

- `GET /api/salary` - Get all salary configs (Admin/Payroll)
- `GET /api/salary/:employeeId` - Get salary config (Role-based access)
- `POST /api/salary` - Create salary config (Admin/Payroll)
- `PUT /api/salary/:employeeId` - Update salary config (Admin/Payroll)
- `DELETE /api/salary/:employeeId` - Delete salary config (Admin/Payroll)

### Dashboard Endpoints

- `GET /api/dashboard/stats` - Get dashboard statistics (Role-based)

### Time Tracking Endpoints

- `GET /api/time-tracking/logs` - Get time logs
- `POST /api/time-tracking/logs` - Create time log
- `POST /api/time-tracking/timer/start` - Start timer
- `POST /api/time-tracking/timer/stop` - Stop timer
- `PUT /api/time-tracking/logs/:id` - Update time log
- `DELETE /api/time-tracking/logs/:id` - Delete time log

### Company Endpoints

- `GET /api/company/me` - Get company information
- `PATCH /api/company` - Update company (Admin only)

## 👤 Role-Based Access Control (RBAC)

### Roles

1. **Admin**
   - Full system access
   - User management
   - Company management
   - All HR and Payroll functions
   - Leave approvals
   - Payroll management

2. **HR Officer**
   - Employee management
   - Leave approvals (except own leaves)
   - Attendance viewing
   - Dashboard access (without payroll stats)
   - Cannot access payroll functions
   - Cannot see own leave requests in pending list (routed to Admin)

3. **Payroll Officer**
   - Payroll management
   - Salary configuration
   - Payrun creation and management
   - Dashboard access (finance-focused)
   - Cannot access leave requests
   - Cannot access employee management (except salary)

4. **Employee**
   - View own profile
   - View own attendance
   - Submit leave requests
   - View own payslips
   - Time tracking
   - View own salary (read-only)

### Access Control Implementation

- **Middleware-based RBAC** in `server/src/middleware/rbac.ts`
- **Route protection** with `requireRole()`, `requireAdmin()`, `requireHR()`, etc.
- **Frontend route protection** with `ProtectedRoute` and `RoleProtectedRoute` components
- **UI component visibility** based on user role

## 🔄 Real-time Updates

WorkZen uses **WebSocket** for real-time updates:

### WebSocket Connection

- **Endpoint**: `ws://localhost:3000/ws` (development)
- **Protocol**: WebSocket over HTTP/HTTPS
- **Authentication**: Cookie-based (same as REST API)

### Real-time Events

- **attendance** - Attendance status changes
- **leaveRequest** - Leave request status changes
- **time_logs** - Time log updates
- **employees** - Employee status changes
- **users** - User profile updates

### Implementation

- **Backend**: PostgreSQL LISTEN/NOTIFY + WebSocket server
- **Frontend**: Custom `useWS` hook for WebSocket connections
- **Automatic reconnection** on disconnect
- **Event filtering** by company and user

## 📁 Project Structure

```
odooxamathe/
├── client/                 # React frontend
│   ├── src/
│   │   ├── auth/          # Authentication context and routes
│   │   ├── components/    # React components
│   │   │   ├── hrms/      # HRMS-specific components
│   │   │   └── ui/        # Shadcn UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and API client
│   │   ├── pages/         # Page components
│   │   │   ├── hrms/      # HRMS pages
│   │   │   └── saas/      # SaaS pages
│   │   └── context/       # React contexts
│   ├── package.json
│   └── vite.config.ts
│
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── db/            # Database migration and seeding
│   │   ├── domain/        # Domain schemas and types
│   │   ├── libs/          # Database and utility libraries
│   │   ├── middleware/    # Express middleware
│   │   ├── modules/       # Feature modules
│   │   │   ├── auth/      # Authentication
│   │   │   ├── attendance/# Attendance management
│   │   │   ├── company/   # Company management
│   │   │   ├── dashboard/ # Dashboard
│   │   │   ├── employees/ # Employee management
│   │   │   ├── leave/     # Leave management
│   │   │   ├── payroll/   # Payroll management
│   │   │   ├── salary/    # Salary management
│   │   │   └── ...        # Other modules
│   │   ├── realtime/      # WebSocket server
│   │   ├── services/      # External services
│   │   ├── utils/         # Utility functions
│   │   ├── app.ts         # Express app setup
│   │   └── index.ts       # Server entry point
│   ├── db/
│   │   └── migrations/    # Database migrations
│   ├── package.json
│   └── env.example
│
└── README.md
```

## 🧪 Testing

### Backend Testing

```bash
cd server
npm test
```

### Frontend Testing

```bash
cd client
npm test
```

## 🏗️ Building for Production

### Backend Build

```bash
cd server
npm run build
npm start
```

### Frontend Build

```bash
cd client
npm run build
```

The built files will be in `client/dist/`.

## 🚀 Deployment

### Prerequisites

- PostgreSQL database (managed or self-hosted)
- Node.js 20+ runtime
- Environment variables configured
- SSL certificates for HTTPS (production)

### Deployment Steps

1. **Set up PostgreSQL database**
2. **Configure environment variables** on your hosting platform
3. **Run database migrations**: `npm run migrate`
4. **Build backend**: `npm run build`
5. **Start backend server**: `npm start`
6. **Build frontend**: `cd client && npm run build`
7. **Serve frontend** with a web server (Nginx, Apache, etc.) or CDN

### Recommended Hosting

- **Backend**: Railway, Render, Heroku, AWS EC2, DigitalOcean
- **Frontend**: Vercel, Netlify, Cloudflare Pages
- **Database**: AWS RDS, DigitalOcean Managed PostgreSQL, Supabase

## 📝 Database Migrations

### Run Migrations

```bash
cd server
npm run migrate
```

### Rollback Migrations

```bash
cd server
npm run migrate:down
```

## 🔒 Security Features

- **Helmet.js** for HTTP security headers
- **CORS** configuration for cross-origin requests
- **Rate limiting** (configurable)
- **JWT token rotation** with refresh tokens
- **Password hashing** with Argon2
- **SQL injection prevention** with parameterized queries
- **XSS protection** with Content Security Policy
- **Secure cookie** configuration
- **Input validation** with Zod schemas

## 🐛 Troubleshooting

### Common Issues

1. **Database connection errors**
   - Check `DATABASE_URL` in `.env`
   - Ensure PostgreSQL is running
   - Verify database exists

2. **Authentication errors**
   - Check JWT secrets are set and at least 32 characters
   - Verify cookies are enabled in browser
   - Check CORS configuration

3. **WebSocket connection failures**
   - Verify WebSocket endpoint is accessible
   - Check firewall settings
   - Ensure WebSocket server is running

4. **File upload errors**
   - Verify Cloudinary credentials
   - Check file size limits
   - Ensure CORS allows file uploads

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TanStack Query Documentation](https://tanstack.com/query)
- [Shadcn UI Documentation](https://ui.shadcn.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

WorkZen HRMS Development Team

## 🙏 Acknowledgments

- Shadcn UI for beautiful component library
- TanStack for excellent React Query library
- All contributors and open-source libraries used in this project

---

**Note**: This is a production-ready HRMS system. Make sure to configure all environment variables correctly and secure your JWT secrets before deploying to production.

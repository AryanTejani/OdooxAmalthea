# HRMS Implementation Summary

## Overview
Complete HRMS (Human Resource Management System) module integrated with existing PERN auth system.

## Backend Implementation

### Database Schema
- **OrgUnit**: Organizational hierarchy (parent-child relationship)
- **Employee**: Links users to employees with org unit, code, title, join date
- **SalaryConfig**: Employee salary configuration (basic + allowances)
- **Attendance**: Daily attendance tracking (punch in/out, status)
- **LeaveRequest**: Leave management (CASUAL, SICK, UNPAID)
- **Payrun**: Payroll run per month
- **Payslip**: Individual employee payslip with breakdown
- **Activity**: Activity log for audit trail

### API Endpoints

#### Organization (`/api/org`)
- `GET /api/org/units` - List org units
- `POST /api/org/units` - Create org unit (admin only)
- `POST /api/org/employees` - Create employee (HR/admin only)
- `GET /api/org/employees/me` - Get current user's employee record

#### Attendance (`/api/attendance`)
- `POST /api/attendance/punch-in` - Punch in
- `POST /api/attendance/punch-out` - Punch out
- `GET /api/attendance/me?month=YYYY-MM` - Get my attendance
- `GET /api/attendance/board?day=YYYY-MM-DD&orgUnitId=...` - Team board (manager/HR/admin)

#### Leave (`/api/leave`)
- `POST /api/leave` - Create leave request
- `GET /api/leave/mine` - Get my leave requests
- `GET /api/leave/pending` - Get pending requests (manager/HR/admin)
- `POST /api/leave/:id/approve` - Approve leave (manager/HR/admin)
- `POST /api/leave/:id/reject` - Reject leave (manager/HR/admin)

#### Payroll (`/api/payroll`)
- `POST /api/payroll/generate?month=YYYY-MM` - Generate payrun (HR/admin)
- `GET /api/payroll/payruns` - List payruns
- `POST /api/payroll/:payrunId/finalize` - Finalize payrun (HR/admin)
- `GET /api/payroll/:payrunId/payslips` - Get payslips for payrun
- `GET /api/payroll/payslip/:id` - Get payslip details

#### Activity (`/api/activity`)
- `GET /api/activity/latest?limit=50&entity=...` - Get recent activities

### Realtime System
- WebSocket server on `/ws`
- PostgreSQL LISTEN/NOTIFY for real-time updates
- Broadcasts attendance and leave changes to connected clients

### RBAC (Role-Based Access Control)
- **admin**: Full access
- **hr**: HR operations (payroll, employee management)
- **manager**: Team management (attendance board, leave approval)
- **employee**: Basic operations (punch in/out, leave requests)

## Frontend Implementation

### Pages
1. **Dashboard** (`/hrms/dashboard`)
   - KPIs: Present Today, On Leave, Pending Leaves, Current Payrun
   - Charts: Attendance last 7 days, Leave types breakdown
   - Activity feed

2. **Attendance** (`/hrms/attendance`)
   - Punch card (punch in/out)
   - Team board (live updates via WebSocket)
   - Monthly attendance calendar/list

3. **Leave** (`/hrms/leave`)
   - My leave requests
   - New leave request dialog
   - Pending approvals (HR/manager)
   - Approve/Reject actions

4. **Payroll** (`/hrms/payroll`)
   - Generate payrun
   - List payruns
   - View payslips
   - Payslip details modal

### Components
- `PunchCard`: Punch in/out interface
- `TeamBoard`: Real-time team attendance board
- `LeaveTable`: Leave requests table with status badges
- `PayrollRunCard`: Payrun generation interface
- `PayslipModal`: Payslip details modal

### Hooks
- `useWS`: WebSocket hook with auto-reconnect, event filtering

## Setup Instructions

### 1. Database Migration
```bash
cd server
npx prisma migrate dev --name hrms_init
npx prisma generate
```

### 2. Database Triggers (for realtime)
```bash
# Run the SQL file to create triggers
psql -d your_database -f prisma/triggers.sql
```

### 3. Install Dependencies
```bash
# Backend
cd server
npm install

# Frontend
cd client
npm install
```

### 4. Environment Variables
Ensure `.env` has:
- `DATABASE_URL` - PostgreSQL connection string
- `VITE_API_URL` - Backend API URL (for frontend)

### 5. Run Application
```bash
# Backend
cd server
npm run dev

# Frontend
cd client
npm run dev
```

## Payroll Calculation Rules
- **Gross**: Basic + Sum of allowances
- **PF**: 12% of basic
- **Professional Tax**: ₹200 (fixed)
- **Net**: Gross - PF - Professional Tax

## Features
✅ Modular architecture (repo → service → controller)
✅ RBAC middleware
✅ Zod validation
✅ Realtime updates via WebSocket + PostgreSQL LISTEN/NOTIFY
✅ Activity logging
✅ Clean UI with shadcn/ui components
✅ TypeScript throughout
✅ Error handling with unified error format
✅ Request logging with pino

## Next Steps
1. Run database migration
2. Set up database triggers (see `triggers.sql`)
3. Test realtime functionality
4. Add PDF generation for payslips (optional)
5. Add more charts/analytics
6. Add email notifications for leave approvals



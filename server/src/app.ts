import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errors';
// import { apiRateLimit } from './middleware/rateLimit'; // DISABLED FOR TESTING
import authRoutes from './modules/auth/auth.routes';
import googleOAuthRoutes from './modules/oauth/google.routes';
import orgRoutes from './modules/org/org.routes';
import employeesRoutes from './modules/employees/employees.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import leaveRoutes from './modules/leave/leave.routes';
import payrollRoutes from './modules/payroll/payroll.routes';
import salaryRoutes from './modules/salary/salary.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import activityRoutes from './modules/activity/activity.routes';
import timeTrackingRoutes from './modules/time-tracking/time-tracking.routes';
import usersRoutes from './modules/users/users.routes';
import adminRoutes from './modules/admin/admin.routes';
import uploadRoutes from './modules/upload/upload.routes';
import saasRoutes from './modules/saas/saas.routes';
import companyRoutes from './modules/company/company.routes';
import { healthCheck } from './libs/db';
import { logger } from './config/logger';

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(corsMiddleware);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Global rate limiting - DISABLED FOR TESTING
// TODO: Re-enable before production deployment
// app.use('/api', apiRateLimit);

// Request logging
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
  }, 'Incoming request');
  next();
});

// Routes
app.use('/api/saas', saasRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth/google', googleOAuthRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/time-tracking', timeTrackingRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;


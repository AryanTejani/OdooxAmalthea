import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { apiRateLimit } from './middleware/rateLimit';
import authRoutes from './modules/auth/auth.routes';
import googleOAuthRoutes from './modules/oauth/google.routes';
import orgRoutes from './modules/org/org.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import leaveRoutes from './modules/leave/leave.routes';
import payrollRoutes from './modules/payroll/payroll.routes';
import activityRoutes from './modules/activity/activity.routes';
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

// Global rate limiting
app.use('/api', apiRateLimit);

// Request logging
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
  }, 'Incoming request');
  next();
});

// Health check endpoint
app.get('/healthz', async (req, res) => {
  const dbHealthy = await healthCheck();
  
  if (dbHealthy) {
    res.json({
      status: 'ok',
      db: 'ok',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'error',
      db: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/google', googleOAuthRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/activity', activityRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;


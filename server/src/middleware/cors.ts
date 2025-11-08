import cors from 'cors';
import { env } from '../config/env';

/**
 * CORS middleware configured with single origin and credentials
 */
export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
});


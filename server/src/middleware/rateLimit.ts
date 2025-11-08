import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login, register)
 * DISABLED FOR TESTING: Set to very high values (10000 requests per minute)
 * TODO: Restore to production values before deployment:
 *   windowMs: 1 * 60 * 1000, // 1 minute
 *   max: 10, // 10 requests per window
 */
export const authRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000, // Very high limit for testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for OAuth endpoints
 * DISABLED FOR TESTING: Set to very high values (1000 requests per 5 minutes)
 * TODO: Restore to production values before deployment:
 *   windowMs: 5 * 60 * 1000, // 5 minutes
 *   max: 5, // 5 requests per window
 */
export const oauthRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // Very high limit for testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many OAuth attempts, please try again later',
    },
  },
});

/**
 * General API rate limiter
 * DISABLED FOR TESTING: Set to very high values (100000 requests per 15 minutes)
 * TODO: Restore to production values before deployment:
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   max: 100, // 100 requests per window
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000, // Very high limit for testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});


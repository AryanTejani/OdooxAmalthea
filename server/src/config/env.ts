import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  CORS_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  OAUTH_ALLOWED_REDIRECTS: z.string().min(1),
  // Attendance configuration
  WORK_HOURS_PER_DAY: z.string().transform(Number).pipe(z.number().positive()).default('8'),
  IDLE_BREAK_THRESHOLD_MIN: z.string().transform(Number).pipe(z.number().positive()).default('15'),
  MIN_ACTIVE_HOURS_PRESENT: z.string().transform(Number).pipe(z.number().nonnegative()).default('4'),
  WORK_WEEK_MON_TO_FRI: z.string().transform((val) => val === 'true').default('true'),
  // Cloudinary configuration
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  // Email configuration (Gmail SMTP)
  EMAIL_USER: z.string().email().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  APP_NAME: z.string().default('WorkZen'),
  APP_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export const env = loadEnv();

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

export function getOAuthAllowedRedirects(): string[] {
  return env.OAUTH_ALLOWED_REDIRECTS.split(',').map(url => url.trim());
}

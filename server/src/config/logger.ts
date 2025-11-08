import pino from 'pino';
import { isDevelopment } from './env';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment()
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

export function createChildLogger(bindings: Record<string, any>) {
  return logger.child(bindings);
}


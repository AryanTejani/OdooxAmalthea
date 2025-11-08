import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { healthCheck, closePool } from './libs/db';
import { setupRealtime, closeRealtime } from './realtime';
import { Server as HTTPServer } from 'http';

const PORT = env.PORT;

async function start() {
  try {
    // Check database connection
    const dbHealthy = await healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    logger.info('✅ Database connected');

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`🔐 Environment: ${env.NODE_ENV}`);
    }) as HTTPServer;

    // Setup WebSocket server for realtime
    await setupRealtime(server);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await closeRealtime();
          await closePool();
          logger.info('Database pool closed');
          process.exit(0);
        } catch (error) {
          logger.error({ error }, 'Error during shutdown');
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();


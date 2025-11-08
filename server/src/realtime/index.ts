import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getPgClient, closePgClient } from '../libs/pg';
import { logger } from '../config/logger';
import { RealtimeEvent } from '../domain/types';

let wss: WebSocketServer | null = null;
let pgClient: any = null;

export async function setupRealtime(server: HTTPServer): Promise<void> {
  // Create WebSocket server
  wss = new WebSocketServer({
    server,
    path: '/ws',
  });

  logger.info('WebSocket server started on /ws');

  // Connect to PostgreSQL for LISTEN/NOTIFY
  try {
    pgClient = await getPgClient();
    
    // Listen for realtime channel
    await pgClient.query('LISTEN realtime');
    logger.info('Listening to PostgreSQL NOTIFY channel: realtime');

    // Handle NOTIFY events
    pgClient.on('notification', (msg: { channel: string; payload: string }) => {
      if (msg.channel === 'realtime') {
        try {
          const event: RealtimeEvent = JSON.parse(msg.payload);
          broadcast(event);
        } catch (error) {
          logger.error({ error, payload: msg.payload }, 'Failed to parse NOTIFY payload');
        }
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to setup PostgreSQL LISTEN');
  }

  // Handle WebSocket connections
  wss.on('connection', (ws: WebSocket) => {
    logger.debug('WebSocket client connected');

    ws.on('close', () => {
      logger.debug('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      logger.error({ error }, 'WebSocket error');
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to realtime stream',
    }));
  });
}

export function broadcast(event: RealtimeEvent): void {
  if (!wss) {
    return;
  }

  const message = JSON.stringify({
    type: 'event',
    ...event,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        logger.error({ error }, 'Failed to send WebSocket message');
      }
    }
  });

  logger.debug({ event }, 'Broadcasted realtime event');
}

export async function closeRealtime(): Promise<void> {
  if (wss) {
    wss.close();
    wss = null;
    logger.info('WebSocket server closed');
  }

  await closePgClient();
}



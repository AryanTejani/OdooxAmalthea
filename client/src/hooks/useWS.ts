import { useEffect, useRef, useState, useCallback } from 'react';

interface RealtimeEvent {
  type: 'event' | 'connected';
  table?: string;
  op?: 'INSERT' | 'UPDATE' | 'DELETE';
  row?: Record<string, unknown>;
  message?: string;
}

interface UseWSOptions {
  url?: string;
  onMessage?: (event: RealtimeEvent) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  filter?: (event: RealtimeEvent) => boolean;
  maxEvents?: number;
}

export function useWS(options: UseWSOptions = {}) {
  const getWSUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    if (apiUrl.startsWith('http://')) {
      return apiUrl.replace('http://', 'ws://') + '/ws';
    }
    if (apiUrl.startsWith('https://')) {
      return apiUrl.replace('https://', 'wss://') + '/ws';
    }
    return 'ws://localhost:3000/ws';
  };

  const {
    url = getWSUrl(),
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    filter,
    maxEvents = 100,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventsRef = useRef<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          
          // Apply filter if provided
          if (filter && !filter(data)) {
            return;
          }

          // Add to events array (keep last maxEvents)
          eventsRef.current = [data, ...eventsRef.current].slice(0, maxEvents);
          setEvents([...eventsRef.current]);

          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        onError?.(error);
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [url, onMessage, onError, onConnect, onDisconnect, filter, maxEvents]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    events,
    send,
    reconnect: connect,
    disconnect,
  };
}


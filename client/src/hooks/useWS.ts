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
    if (options.url) {
      return options.url;
    }
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    try {
      const urlObj = new URL(apiUrl);
      const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${urlObj.host}/ws`;
    } catch {
      // Fallback if URL parsing fails
      if (apiUrl.startsWith('http://')) {
        return apiUrl.replace('http://', 'ws://') + '/ws';
      }
      if (apiUrl.startsWith('https://')) {
        return apiUrl.replace('https://', 'wss://') + '/ws';
      }
      return 'ws://localhost:3000/ws';
    }
  };

  const wsUrl = getWSUrl();
  
  const {
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    filter,
    maxEvents = 100,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const eventsRef = useRef<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  // Store callbacks in refs to prevent reconnection loops
  const callbacksRef = useRef({ onMessage, onError, onConnect, onDisconnect, filter, maxEvents });
  
  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = { onMessage, onError, onConnect, onDisconnect, filter, maxEvents };
  }, [onMessage, onError, onConnect, onDisconnect, filter, maxEvents]);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        return; // Already connected or connecting
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        callbacksRef.current.onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          
          const { filter: currentFilter, maxEvents: currentMaxEvents, onMessage: currentOnMessage } = callbacksRef.current;
          
          // Apply filter if provided
          if (currentFilter && !currentFilter(data)) {
            return;
          }

          // Add to events array (keep last maxEvents)
          eventsRef.current = [data, ...eventsRef.current].slice(0, currentMaxEvents);
          setEvents([...eventsRef.current]);

          currentOnMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        callbacksRef.current.onError?.(error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        callbacksRef.current.onDisconnect?.();

        // Only reconnect if it wasn't a manual close (code 1000)
        if (event.code !== 1000) {
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  }, [wsUrl]);

  const disconnect = useCallback(() => {
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      // Use code 1000 (normal closure) to prevent reconnection
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]); // Only reconnect if URL changes

  return {
    isConnected,
    events,
    send,
    reconnect: connect,
    disconnect,
  };
}


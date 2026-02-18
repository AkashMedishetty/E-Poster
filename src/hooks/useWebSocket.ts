import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  clientId?: string;
  message?: string;
}

interface UseWebSocketOptions {
  clientType: 'laptop' | 'bigscreen';
  onMessage?: (message: WebSocketMessage) => void;
}

export function useWebSocket({ clientType, onMessage }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const mountedRef = useRef(true);

  // Keep onMessage ref current without triggering reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log(`${clientType} sent:`, message);
    } else {
      console.warn(`${clientType} WebSocket not connected, cannot send message`);
    }
  }, [clientType]);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      // Don't connect if unmounted or already connected
      if (!mountedRef.current) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

      try {
        const wsUrl = `ws://localhost:3001?type=${clientType}`;
        console.log(`Attempting WebSocket connection to ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log(`${clientType} WebSocket connected successfully`);
          if (mountedRef.current) {
            setIsConnected(true);
            setError(null);
          }
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log(`${clientType} received:`, message);
            onMessageRef.current?.(message);
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onclose = (event) => {
          console.log(`${clientType} WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
          if (mountedRef.current) {
            setIsConnected(false);
            // Reconnect if not a clean close and still mounted
            if (event.code !== 1000) {
              reconnectTimeoutRef.current = setTimeout(() => {
                console.log(`Attempting to reconnect ${clientType}...`);
                connect();
              }, 2000);
            }
          }
        };

        ws.onerror = (err) => {
          console.error(`${clientType} WebSocket error:`, err);
          if (mountedRef.current) {
            setError('WebSocket connection error');
            setIsConnected(false);
          }
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        if (mountedRef.current) {
          setError('Failed to create WebSocket connection');
        }
      }
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [clientType]);

  const connect = useCallback(() => {
    // Force reconnect by closing existing and letting effect handle it
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual reconnect');
      wsRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  return {
    isConnected,
    error,
    sendMessage,
    connect,
    disconnect
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { env } from '@/config/env';
import { STORAGE_KEYS } from '@/features/auth/storage';

/**
 * Hook de notificaciones en tiempo real mediante WebSockets (Django Channels).
 *
 * Reconexión exponencial, latido periódico y estado de conexión expuesto para
 * que la interfaz indique al operador si está en línea.
 */
export function useNotificationsSocket({ onMessage } = {}) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState('disconnected');
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);
  const retriesRef = useRef(0);
  const heartbeatRef = useRef(null);
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    const token = localStorage.getItem(STORAGE_KEYS.access);
    if (!token || !isAuthenticated) return;

    const url = `${env.wsBaseUrl}/notifications/?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;
    setStatus('connecting');

    socket.onopen = () => {
      retriesRef.current = 0;
      setStatus('connected');
      heartbeatRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: 'ping' }));
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent(data);
        handlerRef.current?.(data);
      } catch {
        /* Mensaje no JSON: se ignora. */
      }
    };

    socket.onclose = () => {
      clearInterval(heartbeatRef.current);
      setStatus('disconnected');
      if (isAuthenticated && retriesRef.current < 6) {
        const delay = Math.min(30000, 2 ** retriesRef.current * 1000);
        retriesRef.current += 1;
        setTimeout(connect, delay);
      }
    };

    socket.onerror = () => socket.close();
  }, [isAuthenticated]);

  useEffect(() => {
    connect();
    return () => {
      clearInterval(heartbeatRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
    };
  }, [connect]);

  return { status, lastEvent };
}

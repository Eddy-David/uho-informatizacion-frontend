import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cn } from '@/utils';

const ToastContext = createContext(null);

const ICONS = {
  success: '✓',
  error: '!',
  info: 'i',
  warning: '⚠',
};

const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-brand-200 bg-brand-50 text-brand-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 4000) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (msg) => push(msg, 'success'),
      error: (msg) => push(msg, 'error', 6000),
      info: (msg) => push(msg, 'info'),
      warning: (msg) => push(msg, 'warning', 5000),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-md animate-slide-in items-start gap-3 rounded-lg border px-4 py-3 shadow-float',
              STYLES[toast.type],
            )}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold">
              {ICONS[toast.type]}
            </span>
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-lg leading-none opacity-60 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  return context;
}

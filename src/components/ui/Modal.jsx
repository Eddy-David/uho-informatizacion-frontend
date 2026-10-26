import { useEffect } from 'react';
import Icon from './Icon';
import { cn } from '@/utils';

/** Modal accesible con cierre por Escape y clic en el fondo. */
export default function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'card w-full animate-fade-in overflow-hidden rounded-b-none sm:rounded-xl',
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between border-b border-brand-100 px-5 py-4">
          <div>
            <h2 id="modal-title" className="card-title">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-brand-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-700"
            aria-label="Cerrar"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-brand-100 bg-brand-50/40 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

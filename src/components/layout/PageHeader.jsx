import { cn } from '@/utils';

/** Cabecera estándar de página: título, descripción y acciones. */
export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title">{title}</h1>
          {badge && <span className="badge-info">{badge}</span>}
        </div>
        {description && <p className="page-subtitle max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Contenedor de contenido de página. */
export function PageContainer({ children, className }) {
  return <div className={cn('mx-auto w-full max-w-7xl animate-fade-in', className)}>{children}</div>;
}

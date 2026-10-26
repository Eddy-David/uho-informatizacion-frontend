/**
 * Estados de carga / vacío / error para tablas y contenedores de datos.
 */
import Icon from './Icon';

export function LoadingRows({ rows = 4, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <td key={colIndex} className="border-b border-brand-50 px-4 py-4">
              <div className="h-3 rounded bg-brand-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyState({ title = 'Sin datos', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-400">
        <Icon name="file" size={22} />
      </span>
      <p className="font-medium text-brand-800">{title}</p>
      {description && <p className="max-w-sm text-sm text-brand-400">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
        <Icon name="alert" size={22} />
      </span>
      <p className="font-medium text-brand-800">No se pudo cargar la información</p>
      <p className="max-w-md text-sm text-brand-400">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
          <Icon name="refresh" size={14} /> Reintentar
        </button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 4 }) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: 5 }).map((_, index) => (
              <th key={index}>
                <div className="h-3 w-20 animate-pulse rounded bg-brand-100" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <LoadingRows rows={rows} cols={5} />
        </tbody>
      </table>
    </div>
  );
}

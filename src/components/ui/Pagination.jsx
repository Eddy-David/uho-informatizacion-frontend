/**
 * Paginación reutilizable para listados del backend (DRF: count/next/previous).
 *
 * Props:
 *  - page / pageCount: página actual y total de páginas.
 *  - onPageChange(nuevoNumeroDePagina).
 *  - total: cantidad total de elementos (opcional, se muestra como texto).
 */
export default function Pagination({ page = 1, pageCount = 1, total, onPageChange }) {
  const prev = () => onPageChange(Math.max(1, page - 1));
  const next = () => onPageChange(Math.min(pageCount, page + 1));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-100 px-4 py-3 text-sm text-brand-500">
      <span>{typeof total === 'number' ? `${total} registro${total === 1 ? '' : 's'}` : `Página ${page} de ${pageCount}`}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={prev}>
          Anterior
        </button>
        <span className="mono">
          {page} / {pageCount}
        </span>
        <button type="button" className="btn-secondary btn-sm" disabled={page >= pageCount} onClick={next}>
          Siguiente
        </button>
      </div>
    </div>
  );
}

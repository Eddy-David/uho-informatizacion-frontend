import { Link } from 'react-router-dom';

/** Página 404. */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <p className="font-display text-7xl font-bold text-brand-200">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-900">
        Página no encontrada
      </h1>
      <p className="mt-2 max-w-md text-sm text-brand-500">
        La dirección solicitada no existe o fue movida. Regrese al panel principal para continuar.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Volver al panel
      </Link>
    </div>
  );
}

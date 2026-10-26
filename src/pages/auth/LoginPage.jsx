import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/features/auth/AuthContext';
import { parseApiError } from '@/services/api';
import { env } from '@/config/env';
import Icon from '@/components/ui/Icon';

/** Pantalla de autenticación. */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const redirectTo = location.state?.from?.pathname || '/';

  async function onSubmit(values) {
    setServerError('');
    try {
      await login(values);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(parseApiError(error));
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel institucional */}
      <div className="relative hidden flex-col justify-between bg-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 font-display text-xl font-bold text-gold-400">
            UHO
          </div>
          <div>
            <p className="font-display text-xl font-semibold">{env.appName}</p>
            <p className="text-xs uppercase tracking-widest text-brand-300">
              Universidad de Holguín
            </p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Sistema de Desarrollo para el Proceso de Informatización
          </h1>
          <p className="mt-4 text-brand-200">
            Gestión integral del control de acceso al campus, solapín digital, visitantes,
            vehículos, incidencias y reportes institucionales.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-brand-200">
            {[
              'Solapín digital con verificación por QR',
              'Bitácora de accesos auditable en tiempo real',
              'Solicitudes de visita con flujo de aprobación',
              'Reportes exportables en PDF y Excel',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-400/20 text-gold-400">
                  <Icon name="check" size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-brand-400">
          © {new Date().getFullYear()} Universidad de Holguín · Uso institucional
        </p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-900 font-display text-xl font-bold text-gold-400">
              UHO
            </div>
            <p className="font-display text-2xl font-semibold text-brand-900">{env.appName}</p>
          </div>

          <h2 className="font-display text-2xl font-semibold text-brand-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-brand-500">
            Utilice su usuario de red institucional (AGA_AUTH / SIGENU).
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="label">
                Usuario
              </label>
              <input
                id="username"
                autoComplete="username"
                className="input"
                placeholder="nombre.apellido"
                {...register('username', { required: 'El usuario es obligatorio.' })}
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                {...register('password', { required: 'La contraseña es obligatoria.' })}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Verificando…' : 'Entrar al sistema'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-brand-400">
            ¿Olvidó su contraseña? Contacte con la Dirección de Tecnologías de la Información.
          </p>
        </div>
      </div>
    </div>
  );
}

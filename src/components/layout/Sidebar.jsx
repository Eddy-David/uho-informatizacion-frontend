import { NavLink } from 'react-router-dom';
import { cn } from '@/utils';
import Icon from '@/components/ui/Icon';
import { env } from '@/config/env';
import { visibleSections } from '@/config/navigation';
import { useAuth } from '@/features/auth/AuthContext';

/** Barra lateral de navegación principal (responsiva). */
export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const sections = visibleSections(user);

  return (
    <>
      {/* Fondo para móvil */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar menú"
        className={cn(
          'fixed inset-0 z-30 cursor-default bg-brand-900/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-brand-900 text-brand-100 transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 font-display text-lg font-bold text-gold-400">
            UHO
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-white">{env.appName}</p>
            <p className="text-[11px] uppercase tracking-wider text-brand-300">
              Proceso de Informatización
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-brand-400">
                {section.label}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                          isActive
                            ? 'bg-white/10 font-medium text-white shadow-inner'
                            : 'text-brand-200 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      <Icon name={item.icon} size={17} />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4 text-[11px] text-brand-400">
          <p>{env.institution}</p>
          <p className="mt-1 font-mono">v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</p>
        </div>
      </aside>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useNotificationsSocket } from '@/features/notifications/useNotificationsSocket';
import { notificationService } from '@/services';
import Icon from '@/components/ui/Icon';
import { cn, initialsOf } from '@/utils';

/** Barra superior con notificaciones y menú de usuario. */
export default function Topbar({ onMenuClick, unread, setUnread }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useNotificationsSocket({
    onMessage: (event) => {
      if (event.type === 'notification.created' || event.type === 'security.alert') {
        setUnread((value) => value + 1);
      }
    },
  });

  useEffect(() => {
    notificationService
      .unreadCount()
      .then((data) => setUnread(data.count))
      .catch(() => setUnread(0));
  }, [setUnread]);

  useEffect(() => {
    const onClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-brand-100 bg-white/90 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md p-2 text-brand-600 hover:bg-brand-50 lg:hidden"
          onClick={onMenuClick}
          aria-label="Abrir menú"
        >
          <Icon name="menu" size={20} />
        </button>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
            Sistema de Desarrollo para el Proceso de Informatización
          </p>
          <p className="text-sm font-medium text-brand-800">Universidad de Holguín</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/notificaciones"
          className="relative rounded-lg p-2 text-brand-600 hover:bg-brand-50"
          aria-label="Notificaciones"
        >
          <Icon name="bell" size={20} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-3 rounded-lg py-1.5 pl-1.5 pr-3 hover:bg-brand-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-800 text-sm font-semibold text-white">
              {user?.initials || initialsOf(user?.full_name)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-brand-900">
                {user?.full_name}
              </span>
              <span className="block text-xs text-brand-400">{user?.role_display}</span>
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 animate-fade-in overflow-hidden rounded-xl border border-brand-100 bg-white shadow-float">
              <div className="border-b border-brand-50 px-4 py-3">
                <p className="text-sm font-medium text-brand-900">{user?.full_name}</p>
                <p className="text-xs text-brand-400">{user?.username}</p>
              </div>
              <Link
                to="/perfil"
                onClick={() => setMenuOpen(false)}
                className={cn('flex items-center gap-2 px-4 py-2.5 text-sm text-brand-700 hover:bg-brand-50')}
              >
                <Icon name="user" size={16} /> Mi perfil
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <Icon name="logout" size={16} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

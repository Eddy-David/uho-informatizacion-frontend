import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/** Estructura principal de la aplicación autenticada. */
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  return (
    <div className="min-h-full bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-72">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          unread={unread}
          setUnread={setUnread}
        />
        <main className="flex-1 px-4 py-6 lg:px-8">
          <Outlet context={{ unread, setUnread }} />
        </main>
        <footer className="border-t border-brand-100 px-4 py-4 text-center text-xs text-brand-400 lg:px-8">
          SIGACU · Universidad de Holguín · Uso institucional
        </footer>
      </div>
    </div>
  );
}

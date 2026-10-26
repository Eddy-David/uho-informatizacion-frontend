import { useEffect, useState } from 'react';
import { userService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/utils';
import { useAuth } from '@/features/auth/AuthContext';

const ROLES = [
  { value: 'SA', label: 'Superadministrador' },
  { value: 'ADM', label: 'Administrador' },
  { value: 'DSP', label: 'Director de Seguridad y Protección' },
  { value: 'SEG', label: 'Personal de Seguridad' },
  { value: 'AV', label: 'Aprobador de Visitas' },
  { value: 'CUADRO', label: 'Cuadro / Directivo' },
  { value: 'USUARIO', label: 'Trabajador / Estudiante' },
];

const EMPTY_USER = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  identity_card: '',
  role: 'USUARIO',
  user_type: 'TRABAJADOR',
  access_level: 'LIMITADO',
  campus: 'CENTRAL',
  area: '',
  position: '',
  password: '',
};

/** Administración de usuarios, roles y permisos (RF-08). */
export default function UsersPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ count: 0 });
  const [filters, setFilters] = useState({ search: '', role: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [data, statistics] = await Promise.all([
        userService.list({ ...filters, page_size: 20 }),
        userService.stats(),
      ]);
      setUsers(data.results || data);
      setMeta({ count: data.count ?? 0, next: data.next });
      setStats(statistics);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [filters]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_USER);
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditing(user);
    setForm({ ...EMPTY_USER, ...user, password: '' });
    setModalOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (editing) await userService.update(editing.uuid, payload);
      else await userService.create(payload);
      toast.success(editing ? 'Usuario actualizado.' : 'Usuario creado.');
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    try {
      await userService.toggleActive(user.uuid);
      toast.success('Estado actualizado.');
      await load();
    } catch (err) {
      toast.error(parseApiError(err));
    }
  }

  async function resetPassword(user) {
    if (!window.confirm(`¿Generar una contraseña temporal para ${user.full_name}?`)) return;
    try {
      const data = await userService.resetPassword(user.uuid);
      window.alert(`Contraseña temporal: ${data.temporary_password}\nEntréguela por vía segura.`);
    } catch (err) {
      toast.error(parseApiError(err));
    }
  }

  const totalPages = Math.max(1, Math.ceil((meta.count || 0) / 20));

  return (
    <PageContainer>
      <PageHeader
        title="Administración · Usuarios y roles"
        description="Gestión de cuentas institucionales, roles y niveles de acceso."
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Icon name="plus" size={16} /> Nuevo usuario
          </button>
        }
      />

      {stats && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-brand-400">Usuarios totales</p>
            <p className="font-display text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-brand-400">Activos</p>
            <p className="font-display text-2xl font-semibold text-emerald-600">{stats.active}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-brand-400">Administradores</p>
            <p className="font-display text-2xl font-semibold">
              {(stats.by_role?.SA || 0) + (stats.by_role?.ADM || 0)}
            </p>
          </div>
        </div>
      )}

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="search">Buscar</label>
          <input
            id="search"
            className="input"
            placeholder="Nombre, usuario o CI…"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
          />
        </div>
        <div>
          <label className="label" htmlFor="role">Rol</label>
          <select
            id="role"
            className="input"
            value={filters.role}
            onChange={(event) => setFilters({ ...filters, role: event.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>CI</th>
                  <th>Rol</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      {Array.from({ length: 8 }).map((__, cell) => (
                        <td key={cell} className="border-b border-brand-50 px-4 py-3">
                          <div className="h-3 rounded bg-brand-100" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState title="Sin usuarios" />
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.uuid}>
                    <td className="mono">{user.username}</td>
                    <td className="font-medium">{user.full_name}</td>
                    <td className="mono">{user.identity_card || '—'}</td>
                    <td>{user.role_display}</td>
                    <td>{user.user_type}</td>
                    <td>
                      <span className={user.is_active ? 'badge-success' : 'badge-neutral'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(user.last_login)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(user)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          title="Restablecer contraseña"
                          onClick={() => resetPassword(user)}
                        >
                          <Icon name="refresh" size={14} />
                        </button>
                        <button
                          type="button"
                          className={user.is_active ? 'btn-danger btn-sm' : 'btn-sm bg-emerald-600 text-white'}
                          disabled={user.uuid === currentUser?.uuid}
                          onClick={() => toggleActive(user)}
                        >
                          {user.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-brand-500">
            <span>{meta.count} usuarios</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                Anterior
              </button>
              <span>{filters.page} / {totalPages}</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={!meta.next}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="user-form" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="username">Usuario de red</label>
            <input
              id="username"
              className="input"
              required
              disabled={!!editing}
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="first_name">Nombre</label>
            <input
              id="first_name"
              className="input"
              required
              value={form.first_name}
              onChange={(event) => setForm({ ...form, first_name: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="last_name">Apellidos</label>
            <input
              id="last_name"
              className="input"
              required
              value={form.last_name}
              onChange={(event) => setForm({ ...form, last_name: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="ci">Carnet de identidad</label>
            <input
              id="ci"
              className="input mono"
              maxLength={11}
              value={form.identity_card}
              onChange={(event) => setForm({ ...form, identity_card: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="position">Cargo</label>
            <input
              id="position"
              className="input"
              value={form.position}
              onChange={(event) => setForm({ ...form, position: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="role-select">Rol</label>
            <select
              id="role-select"
              className="input"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="user_type">Tipo de usuario</label>
            <select
              id="user_type"
              className="input"
              value={form.user_type}
              onChange={(event) => setForm({ ...form, user_type: event.target.value })}
            >
              {['ESTUDIANTE', 'PROFESOR', 'TRABAJADOR', 'CUADRO'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="access_level">Nivel de acceso</label>
            <select
              id="access_level"
              className="input"
              value={form.access_level}
              onChange={(event) => setForm({ ...form, access_level: event.target.value })}
            >
              {['LIBRE', 'LIMITADO', 'RESTRINGIDO', 'ESTUDIANTE'].map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="area">Área / dependencia</label>
            <input
              id="area"
              className="input"
              value={form.area}
              onChange={(event) => setForm({ ...form, area: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="password">
              Contraseña {editing && '(dejar vacío para no cambiarla)'}
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}

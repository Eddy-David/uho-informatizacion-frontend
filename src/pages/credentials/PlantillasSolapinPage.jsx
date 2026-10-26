import { useEffect, useState } from 'react';
import { credentialService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState } from '@/components/ui/DataStates';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import StatusBadge from '@/components/ui/StatusBadge';

const USER_TYPES = ['ESTUDIANTE', 'PROFESOR', 'TRABAJADOR', 'CUADRO', 'VISITANTE'];
const ZONES_INFO = [
  { key: 'photo', label: 'Fotografía' },
  { key: 'name', label: 'Nombre y apellidos' },
  { key: 'identity_card', label: 'Carnet de identidad' },
  { key: 'user_type', label: 'Tipo de usuario / área' },
  { key: 'qr', label: 'Código QR' },
  { key: 'access_level', label: 'Nivel de acceso' },
];

/** Configurador de plantillas del Solapín Digital. */
export default function BadgeTemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', user_type: 'ESTUDIANTE', is_default: false });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await credentialService.templates({ page_size: 50 });
      setTemplates(data.results || data);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await credentialService.createTemplate({
        ...form,
        zones: {
          photo: { x: 6, y: 20, w: 30, h: 34 },
          name: { x: 40, y: 22, w: 54, h: 12 },
          identity_card: { x: 40, y: 36, w: 54, h: 8 },
          qr: { x: 62, y: 56, w: 30, h: 30 },
          access_level: { x: 6, y: 80, w: 50, h: 10 },
        },
      });
      toast.success('Plantilla creada.');
      setOpen(false);
      setForm({ name: '', user_type: 'ESTUDIANTE', is_default: false });
      await load();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Solapín Digital · Plantillas"
        description="Imagen base, colores y zonas dinámicas (foto, nombre, CI, QR y nivel de acceso) por tipo de usuario."
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={16} /> Nueva plantilla
          </button>
        }
      />

      {error && (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {!error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading &&
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="card h-56 animate-pulse bg-brand-50" />
            ))}
          {!loading && templates.length === 0 && (
            <div className="card md:col-span-2 xl:col-span-3">
              <EmptyState
                title="No hay plantillas"
                description="Cree la primera plantilla del Solapín Digital."
              />
            </div>
          )}
          {templates.map((template) => (
            <div key={template.uuid} className="card overflow-hidden">
              <div
                className="relative h-32 p-4 text-white"
                style={{
                  background: `linear-gradient(140deg, ${template.primary_color} 0%, ${template.secondary_color} 160%)`,
                }}
              >
                <div className="flex justify-between">
                  <span className="font-display text-lg font-bold text-white/90">UHO</span>
                  {template.is_default && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase">
                      Por defecto
                    </span>
                  )}
                </div>
                {ZONES_INFO.map((zone) =>
                  template.zones?.[zone.key] ? (
                    <span
                      key={zone.key}
                      title={zone.label}
                      className="absolute rounded border border-dashed border-white/60 bg-white/10"
                      style={{
                        left: `${template.zones[zone.key].x}%`,
                        top: `${template.zones[zone.key].y}%`,
                        width: `${template.zones[zone.key].w * 0.6}%`,
                        height: `${template.zones[zone.key].h * 0.5}%`,
                      }}
                    />
                  ) : null,
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-brand-900">{template.name}</p>
                    <p className="text-xs text-brand-400">{template.user_type_display}</p>
                  </div>
                  <StatusBadge status={template.status} label={template.status === 'ACTIVO' ? 'Activa' : 'Inactiva'} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1 text-[11px] text-brand-500">
                  {Object.keys(template.zones || {}).map((zone) => (
                    <span key={zone} className="rounded bg-brand-50 px-2 py-0.5">
                      {ZONES_INFO.find((item) => item.key === zone)?.label || zone}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva plantilla de solapín"
        description="La plantilla define la imagen y las zonas dinámicas de la credencial."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="template-form" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Crear plantilla'}
            </button>
          </>
        }
      >
        <form id="template-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label" htmlFor="tpl-name">Nombre</label>
            <input
              id="tpl-name"
              className="input"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ej. Plantilla Estudiantes 2026"
            />
          </div>
          <div>
            <label className="label" htmlFor="tpl-type">Tipo de usuario</label>
            <select
              id="tpl-type"
              className="input"
              value={form.user_type}
              onChange={(event) => setForm({ ...form, user_type: event.target.value })}
            >
              {USER_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-brand-700">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(event) => setForm({ ...form, is_default: event.target.checked })}
            />
            Usar como plantilla por defecto para este tipo de usuario
          </label>
        </form>
      </Modal>
    </PageContainer>
  );
}

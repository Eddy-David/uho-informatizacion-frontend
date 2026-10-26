import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { coreService, visitorService } from '@/services';
import { parseApiError } from '@/services/api';
import { PageContainer, PageHeader } from '@/components/layout/PageHeader';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

/** Formulario de solicitud de visita (rol Cuadro / Directivo). */
export default function NewVisitPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [campuses, setCampuses] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState('CENTRAL');
  const [units, setUnits] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      campus: 'CENTRAL',
      valid_from: new Date().toISOString().slice(0, 10),
      valid_until: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    coreService.campuses().then((data) => setCampuses(data.results || data)).catch(() => { });
  }, []);

  useEffect(() => {
    coreService
      .units({ page_size: 100 })
      .then((data) => setUnits(data.results || data))
      .catch(() => { });
  }, []);

  async function onSubmit(values) {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        valid_from: values.valid_from,
        valid_until: values.valid_until,
      };
      await visitorService.create(payload);
      toast.success('Solicitud enviada al aprobador de visitas.');
      reset();
      navigate('/visitantes');
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Visitantes · Nueva solicitud"
        description="Solicite la entrada de un visitante indicando el área, el motivo y el período de vigencia."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="card-title mb-4">Datos del visitante</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="visitor_name">Nombre y apellidos</label>
              <input
                id="visitor_name"
                className="input"
                {...register('visitor_name', { required: 'Indique el nombre del visitante.' })}
              />
              {errors.visitor_name && <p className="mt-1 text-xs text-red-600">{errors.visitor_name.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="visitor_identity_card">Carnet de identidad</label>
              <input
                id="visitor_identity_card"
                className="input mono"
                maxLength={11}
                {...register('visitor_identity_card', {
                  required: 'El CI es obligatorio.',
                  pattern: { value: /^\d{11}$/, message: 'Debe tener 11 dígitos.' },
                })}
              />
              {errors.visitor_identity_card && (
                <p className="mt-1 text-xs text-red-600">{errors.visitor_identity_card.message}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="visitor_phone">Teléfono</label>
              <input id="visitor_phone" className="input" {...register('visitor_phone')} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="visitor_organization">Organización</label>
              <input id="visitor_organization" className="input" {...register('visitor_organization')} />
            </div>

            <div className="sm:col-span-2 mt-2 border-t border-brand-50 pt-4">
              <h2 className="card-title mb-4">Detalles de la visita</h2>
            </div>
            <div>
              <label className="label" htmlFor="campus">Sede</label>
              <select
                id="campus"
                className="input"
                {...register('campus', { required: true, onChange: (e) => setSelectedCampus(e.target.value) })}
              >
                {campuses.map((campus) => (
                  <option key={campus.code} value={campus.code}>{campus.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="area">Área a visitar</label>
              <input
                id="area"
                className="input"
                list="area-options"
                {...register('area', { required: 'Indique el área a visitar.' })}
              />
              <datalist id="area-options">
                {units.filter((unit) => !selectedCampus || unit.campus_name).map((unit) => (
                  <option key={unit.uuid} value={unit.name} />
                ))}
              </datalist>
              {errors.area && <p className="mt-1 text-xs text-red-600">{errors.area.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="valid_from">Válida desde</label>
              <input id="valid_from" type="date" className="input" {...register('valid_from', { required: true })} />
            </div>
            <div>
              <label className="label" htmlFor="valid_until">Válida hasta</label>
              <input id="valid_until" type="date" className="input" {...register('valid_until', { required: true })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="vehicle_plate">Placa del vehículo (opcional)</label>
              <input id="vehicle_plate" className="input mono" {...register('vehicle_plate')} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="reason">Motivo de la visita</label>
              <textarea
                id="reason"
                rows={4}
                className="input"
                {...register('reason', { required: 'Describa el motivo de la visita.' })}
              />
              {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <Icon name="check" size={16} /> {submitting ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </div>

        <div className="card h-fit p-5">
          <h2 className="card-title">Flujo de aprobación</h2>
          <ol className="mt-4 space-y-4 text-sm">
            {[
              { title: 'Solicitud', text: 'El cuadro registra los datos del visitante.' },
              { title: 'Revisión', text: 'El Aprobador de Visitas valida la solicitud.' },
              { title: 'Solapín temporal', text: 'Al aprobarse se genera la credencial con vigencia limitada.' },
              { title: 'Acceso', text: 'El visitante presenta su credencial en el punto de control.' },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-brand-800">{step.title}</p>
                  <p className="text-xs text-brand-400">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </form>
    </PageContainer>
  );
}

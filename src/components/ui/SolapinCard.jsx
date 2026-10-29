import { useCallback, useEffect, useState } from 'react';
import { credentialService } from '@/services';
import { parseApiError } from '@/services/api';
import { downloadBlob, filenameFromDisposition, formatDate } from '@/utils';
import Icon from '@/components/ui/Icon';
import StatusBadge from '@/components/ui/StatusBadge';

/**
 * Solapín Digital del usuario autenticado (RF-02.3).
 *
 * No dibuja nada de la credencial: pide al backend la **imagen final** ya
 * compuesta (plantilla + datos + QR, RF-03.3) y la muestra con un `<img>`.
 * Los datos de texto (número, vigencia, nivel) vienen de `/solapines/mio/`.
 */
export default function SolapinCard() {
  const [badge, setBadge] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const loadImage = useCallback(async () => {
    try {
      const blob = await credentialService.myBadgeImage();
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    } catch (err) {
      setError(parseApiError(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([credentialService.mySolapin(), credentialService.myBadgeImage()])
      .then(([data, blob]) => {
        if (!active) return;
        setBadge(data);
        setImageUrl(URL.createObjectURL(blob));
      })
      .catch((err) => active && setError(parseApiError(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Libera el object URL anterior (o el último al desmontar) para no fugar memoria.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await credentialService.downloadMyBadge();
      downloadBlob(
        response.data,
        filenameFromDisposition(
          response.headers['content-disposition'],
          `solapin-${badge?.badge_number || 'uho'}.png`,
        ),
      );
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="card overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-brand-900">Solapín Digital</h3>
        {badge && (
          <StatusBadge
            status={badge.status}
            label={badge.is_valid ? 'Vigente' : 'No vigente'}
          />
        )}
      </div>

      <div className="relative min-h-[180px] overflow-hidden rounded-xl bg-brand-50">
        {loading && (
          <div className="flex min-h-[180px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
          </div>
        )}

        {!loading && error && (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 p-4 text-center">
            <Icon name="x" size={22} className="text-red-500" />
            <p className="text-sm text-brand-500">{error}</p>
            <button type="button" className="btn-secondary text-xs" onClick={loadImage}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && imageUrl && (
          <img
            src={imageUrl}
            alt={badge ? `Solapín de ${badge.user_detail?.full_name}` : 'Solapín digital'}
            className="w-full rounded-xl shadow-sm"
          />
        )}
      </div>

      {badge && (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="label">Número</dt>
            <dd className="mono text-brand-800">{badge.badge_number}</dd>
          </div>
          <div>
            <dt className="label">Nivel</dt>
            <dd className="text-brand-800">{badge.access_level_display}</dd>
          </div>
          <div>
            <dt className="label">Expedido</dt>
            <dd className="text-brand-800">{formatDate(badge.issued_at)}</dd>
          </div>
          <div>
            <dt className="label">Vence</dt>
            <dd className="text-brand-800">
              {badge.expires_at ? formatDate(badge.expires_at) : 'Sin vencimiento'}
            </dd>
          </div>
        </dl>
      )}

      <button
        type="button"
        className="btn-primary mt-4 w-full"
        onClick={handleDownload}
        disabled={downloading || loading || !badge}
      >
        <Icon name="download" size={16} />
        {downloading ? 'Descargando…' : 'Descargar Solapín'}
      </button>
    </div>
  );
}

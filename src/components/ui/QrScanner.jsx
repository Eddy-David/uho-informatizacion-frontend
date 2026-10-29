import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Icon from '@/components/ui/Icon';

/**
 * Motivo por el que el navegador bloquea la cámara (RF-04.1).
 *
 * `getUserMedia` sólo existe en "contextos seguros": HTTPS o `localhost`.
 * Si la app se abre desde otro equipo con `http://192.168.x.x:5173`,
 * `navigator.mediaDevices` ni siquiera existe y el vídeo nunca aparece.
 */
export function insecureContextReason() {
  if (typeof window === 'undefined') return '';
  if (window.isSecureContext) return '';
  if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') return '';
  return (
    'La cámara está bloqueada porque la página no está en un contexto seguro (HTTPS). ' +
    'Abra la app desde el túnel HTTPS (scripts/tunel.sh) o desde localhost con port forwarding.'
  );
}

/** Mensaje de error del contexto inseguro, reutilizado por la página y el modal. */
export const INSECURE_CONTEXT_MESSAGE = insecureContextReason();

/** Bloque que sustituye el cuadro negro del vídeo cuando la cámara no arranca. */
function CameraErrorBox({ message }) {
  return (
    <div
      role="alert"
      className="flex h-[300px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-red-600">
        <Icon name="shield" size={24} />
      </span>
      <p className="text-sm font-medium text-red-700">No se pudo abrir la cámara</p>
      <p className="text-xs text-red-600">{message}</p>
      <p className="text-xs text-brand-400 break-all">{window.location.origin}</p>
    </div>
  );
}

/** ¿El dispositivo tiene alguna cámara disponible (si el navegador lo permite)? */
function hasMediaDevices() {
  return Boolean(
    typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && window.isSecureContext,
  );
}

/** Traduce el error del navegador a un mensaje para el usuario. */
function describeError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'No se pudo acceder a la cámara. Verifique los permisos del navegador para este sitio.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'No se pudo acceder a la cámara: no se encontró ninguna cámara conectada.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'No se pudo acceder a la cámara: está siendo usada por otra aplicación.';
  }
  if (name === 'AbortError') {
    return 'No se pudo acceder a la cámara: el arranque se interrumpió. Cierre el escáner y vuelva a intentarlo.';
  }
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia ||
    !window.isSecureContext
  ) {
    return 'No se pudo acceder a la cámara: el navegador la bloquea fuera de HTTPS (use localhost).';
  }
  const detalle = name || err?.message;
  return `No se pudo acceder a la cámara. Verifique los permisos${
    detalle ? ` (${detalle})` : ''
  }.`;
}

/**
 * Lector de QR con la cámara del dispositivo (RF-04.1).
 *
 * - Usa `html5-qrcode` con la cámara trasera (`facingMode: environment`).
 * - `onDecode` se llama **una sola vez** por lectura: se pausa el escáner para
 *   no enviar la misma verificación varias veces mientras el QR sigue delante.
 * - El contenedor del vídeo lo monta la propia librería; por eso el `<div>`
 *   tiene un `id` fijo y debe permanecer vacío en React. El `<div>` lleva
 *   tamaño explícito: si mide 0px la cámara arranca pero no se ve la imagen.
 * - La cámara se inicializa en `useEffect` (sólo al montar) y se detiene en el
 *   cleanup (`stop()` + `clear()`), incluyendo cierre del modal o cambio de ruta.
 */
export default function QrScanner({ onDecode }) {
  const containerId = `qr-reader-${useId().replace(/[:]/g, '')}`;
  const scannerRef = useRef(null);
  const decodedRef = useRef(false);
  const [status, setStatus] = useState('starting'); // starting | scanning | error | stopped
  // Un único mensaje de error (string), nunca una lista: se reemplaza al
  // reintentar y se limpia al arrancar de nuevo, para que no se acumule.
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0); // fuerza un reintento tras un error
  const insecure = insecureContextReason();

  useEffect(() => {
    let cancelled = false;
    let scanner = null;

    // El error se muestra SOLO aquí (un único <p>). Antes también se emitía
    // un toast desde la página, lo que duplicaba el mensaje en pantalla.
    const fail = (texto) => {
      if (cancelled) return;
      setStatus('error');
      setMessage(texto);
    };

    // Cada intento parte de cero: sin esto el mensaje anterior se sumaba al nuevo.
    setStatus('starting');
    setMessage('');
    decodedRef.current = false;

    // Contexto inseguro (http://IP-local): ni intentamos, el navegador lo bloquea.
    // El aviso se muestra UNA vez, bajo el botón del escáner (ver
    // `VerificacionAccesoPage`); aquí no se repite dentro del modal.
    if (insecure) {
      console.warn('[QrScanner] Contexto no seguro: la cámara será bloqueada.', window.location.href);
      // También aquí hay mensaje: nunca dejar el cuadro negro sin explicación.
      fail(insecure);
      return undefined;
    }

    if (!hasMediaDevices()) {
      fail('No se pudo acceder a la cámara: el navegador no expone getUserMedia en esta página.');
      return undefined;
    }

    try {
      scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;
    } catch (err) {
      // El contenedor no existe o la librería no pudo montarse: nunca dejar la pantalla en blanco.
      console.error('[QrScanner] No se pudo crear el escáner:', err);
      fail('No se pudo acceder a la cámara. Verifique los permisos e intente de nuevo.');
      return undefined;
    }

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (decodedRef.current) return;
          decodedRef.current = true;
          setStatus('stopped');
          // Se detiene la cámara antes de avisar: evita reintentos y libera el
          // dispositivo mientras el backend procesa la verificación.
          scanner
            .stop()
            .catch(() => { })
            .finally(() => onDecode?.(decodedText));
        },
        () => { }, // los fallos de lectura por frame son normales, se ignoran
      )
      .then(() => {
        if (cancelled) return;
        // `start()` puede resolver sin inyectar el <video> (p. ej. si el
        // contenedor se ocultó o se desmontó a medias). Sin vídeo la pantalla
        // queda en negro: se avisa en lugar de dejarla en blanco.
        const contenedor = document.getElementById(containerId);
        if (!contenedor?.querySelector('video')) {
          fail(
            'La cámara no mostró imagen. Cierre el escáner y vuelva a abrirlo; si persiste, revise los permisos del navegador.',
          );
          return;
        }
        setStatus('scanning');
      })
      .catch((err) => {
        // Si el componente se desmontó mientras arrancaba (cierre del modal o
        // cambio de ruta) la librería aborta: no es un error que mostrar.
        if (cancelled || err?.name === 'AbortError') return;
        console.error('[QrScanner] Falló el arranque de la cámara:', err);
        fail(describeError(err));
      });

    return () => {
      cancelled = true;
      scannerRef.current = null;
      // `stop()` sólo es válido si la cámara llegó a arrancar; si no, `clear()`
      // es suficiente y evita el error "Cannot stop, scanner is not running".
      const cleanup = async () => {
        try {
          if (scanner && scanner.isScanning) await scanner.stop();
        } catch {
          // La cámara pudo liberarse ya (cierre del modal, cambio de ruta).
        }
        try {
          scanner?.clear();
        } catch {
          // El contenedor ya fue desmontado por React.
        }
      };
      cleanup();
    };
    // El ciclo de vida del escáner es único por montaje (o por reintento manual).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, insecure, attempt]);

  return (
    <div className="space-y-3">
      {/* html5-qrcode inyecta aquí el <video>: el div debe tener tamaño
          explícito (si mide 0px la cámara arranca pero no se ve la imagen).
          En error se oculta el vídeo y se muestra el motivo: antes el modal
          quedaba como un cuadro negro sin decir qué pasó. */}
      {status !== 'error' ? (
        <div
          id={containerId}
          className="h-[300px] w-full min-h-[300px] overflow-hidden rounded-lg bg-black [&_canvas]:h-full [&_canvas]:w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
      ) : (
        <CameraErrorBox message={message} />
      )}

      {status === 'starting' && !insecure && (
        <p className="flex items-center justify-center gap-2 text-sm text-brand-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-700" />
          Iniciando cámara…
        </p>
      )}

      {status === 'scanning' && (
        <p className="flex items-center justify-center gap-2 text-sm text-brand-500">
          <Icon name="qr" size={16} /> Apunte la cámara al QR del solapín
        </p>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reintentar
            </button>
          </div>
          {/* Sólo cuando el problema son los permisos: en contexto inseguro el
              mensaje de arriba ya explica el motivo y aquí sobraría. */}
          {!insecure && (
            <p className="text-center text-xs text-brand-400">
              Conceda el permiso de cámara en el navegador (icono del candado en la barra de
              direcciones) y vuelva a intentarlo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

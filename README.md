# Frontend — SIGACU · Universidad de Holguín

SPA empresarial del **SIGACU (Sistema de Gestión de Acceso al Campus
Universitario)** construida con **React 18 + Vite 5 + Tailwind CSS 3**. Consume
la API REST del backend (`../backend`) mediante JWT y recibe notificaciones en
tiempo real por WebSocket. Es además una **PWA instalable** con cola offline
(RF-04.6, RNF-09).

La referencia funcional y visual es el **Documento de Requerimientos v1.0
(junio 2026)** y el mockup interactivo (`../docs/mockup/`). Este README explica
cómo está implementado cada requisito en la interfaz, qué está verificado y
qué queda pendiente.

---

## 1. Requisitos

| Componente | Versión |
|---|---|
| Node.js | 20 LTS (mínimo 18) |
| npm | 10+ |
| Backend en ejecución | `http://localhost:8000` (ver `../backend/README.md`) |

```bash
node --version   # v20.x
npm --version
```

---

## 2. Ejecución

```bash
npm install
cp .env.example .env          # Windows cmd: copy .env.example .env
npm run dev
```

Abra <http://localhost:5173>. El proxy de Vite reenvía `/api`, `/media` y `/ws`
a `http://localhost:8000` (o a `VITE_PROXY_TARGET` si está definida), por lo que
en desarrollo no hay CORS ni contenido mixto.

> `VITE_PROXY_TARGET` es una variable **de Node** (la lee `vite.config.js` con
> `process.env`), por eso se define en el sistema o en la línea de comandos:
> `VITE_PROXY_TARGET=http://127.0.0.1:8000 npm run dev`.

### Variables del cliente (`.env`)

Solo las variables con prefijo `VITE_` llegan al navegador. Consulte
[`.env.example`](.env.example).

| Variable | Por defecto | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | URL base de la API (ruta relativa = mismo origen) |
| `VITE_APP_NAME` | `SIGACU` | Nombre visible de la aplicación |
| `VITE_INSTITUTION_NAME` | `Universidad de Holguin` | Pie de la barra lateral (ASCII obligatorio) |
| `VITE_APP_VERSION` | `1.0.0` | Versión mostrada |
| `VITE_WS_URL` | *(deducida)* | URL del WebSocket (`ws(s)://host/ws`) |
| `VITE_ALLOWED_HOST` | — | IP de la LAN que Vite debe aceptar (uso desde el móvil) |
| `VITE_TUNNEL_ORIGIN` / `VITE_TUNNEL_API_BASE_URL` | — | Las escribe `scripts/tuneles.sh`; no se editan a mano |

> ⚠️ **Nunca** coloque secretos con prefijo `VITE_`: todo lo que empiece por
> `VITE_` se incluye en el bundle y es público.

---

## 3. Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente (5173) |
| `npm run build` | Compilación de producción en `dist/` (+ PWA, gzip y brotli) |
| `npm run preview` | Sirve la compilación para verificarla (4173) |
| `npm test` | Pruebas de la cola offline (RF-04.5 / RNF-09), sin navegador |
| `npm run lint` | ESLint sobre `src/` |
| `npm run format` | Prettier sobre `src/**/*.{js,jsx,css}` |

Antes de cada *commit*: `npm run lint && npm run build`.

---

## 4. Estructura

```
frontend/
├── public/                         # favicon, iconos del manifest (192/512/maskable)
├── src/
│   ├── components/
│   │   ├── layout/                 # AppLayout, Sidebar, Topbar, PageHeader
│   │   └── ui/                     # Icon, Modal, Toast, StatCard, StatusBadge,
│   │                               # Pagination, QrScanner, DataStates
│   ├── config/
│   │   ├── env.js                  # import.meta.env + resolución del túnel
│   │   ├── navigation.js           # Menú, canAccess, visibleSections
│   │   └── permissions.js          # Contrato módulo ↔ permisos del backend
│   ├── features/
│   │   ├── auth/                   # AuthContext, authService, storage
│   │   └── notifications/          # useNotificationsSocket
│   ├── pages/
│   │   ├── auth/                   # LoginPage
│   │   ├── dashboard/              # DashboardPage (KPIs + gráficos)
│   │   ├── profile/                # ProfilePage (datos + solapín propio)
│   │   ├── notifications/          # NotificationsPage
│   │   ├── access/                 # VerificacionAccesoPage, BitacoraAccesoPage
│   │   ├── credentials/            # SolapinesPage, PlantillasSolapinPage
│   │   ├── visitors/               # NuevaSolicitudVisitaPage, SolicitudesVisitaPage
│   │   ├── vehicles/               # VehiculosPage
│   │   ├── incidents/              # IncidenciasPage
│   │   ├── reports/                # ReportesPage
│   │   ├── usuarios/               # UsuariosPage
│   │   ├── admin/                  # CatalogsPage (nomencladores)
│   │   └── NotFoundPage.jsx
│   ├── routes/                     # AppRoutes, routes.config, guards
│   ├── services/                   # api.js (Axios + JWT) e index.js (por dominio)
│   ├── utils/                      # cn, formatDate, downloadBlob, saveDownload,
│   │                               # offlineQueue (+ pruebas)
│   ├── index.css                   # Tailwind + componentes (@layer)
│   └── main.jsx
├── nginx/default.conf              # SPA + proxy /api y /ws (imagen de producción)
├── Dockerfile / Dockerfile.dev
├── vite.config.js                  # Proxy, PWA (Workbox), compresión, túnel
└── package.json
```

**Regla de oro:** `src/` solo contiene código de interfaz. Las reglas de
negocio (roles, estados, validaciones de dominio) viven en el backend y llegan
al cliente como datos.

---

## 5. Capa de servicios

### `src/services/api.js`

Instancia central de Axios con tres responsabilidades:

1. **Adjuntar el JWT** (`Authorization: Bearer <access>`) desde
   `localStorage[STORAGE_KEYS.access]`.
2. **Renovar ante `401`**: llama una sola vez a `/auth/token/refresh/` y encola
   las peticiones concurrentes; si el refresh falla, limpia la sesión y
   redirige a `/login?next=…`.
3. **Normalizar errores**: `parseApiError(error)` traduce la estructura
   `{ error: { code, message, details } }` a un mensaje en español (RF-01.2,
   RNF-01).

### `src/services/index.js`

Servicios por dominio que devuelven `response.data`, de modo que los
componentes no conocen Axios:

```js
import { accessService, reportService } from '@/services';

const { count, results } = await accessService.logs({ result: 'DENEGADO', page: 1 });
```

| Servicio | Dominio |
|---|---|
| `coreService` | Salud, metadatos, sedes, áreas, puntos de control, nomencladores |
| `authService` (en `features/auth`) | Login, logout, perfil, contraseña, roles |
| `userService` | Usuarios, estadísticas, activación, restablecimiento |
| `accessService` | Verificación, sincronización offline, bitácora, KPIs |
| `credentialService` | Mi solapín, verificación, plantillas, solapines, lotes |
| `visitorService` | Solicitudes, aprobación/rechazo/cambios, visitantes dentro |
| `vehicleService` | Catálogo autorizado, verificación de placa, movimientos |
| `incidentService` | Incidencias, cambios de estado, seguimiento |
| `notificationService` | Bandeja, no leídas, marcar leídas |
| `reportService` | Panel, tipos, generación y exportación (Excel/PDF como blob) |

Los parámetros vacíos se omiten con `clean()`.

### Descargas de archivos

Las exportaciones llegan como `blob` (`responseType: 'blob'`):

- `downloadBlob(blob, nombre)` — crea el enlace temporal y descarga.
- `filenameFromDisposition(header)` — respeta el nombre que genera el servidor.
- `saveDownload(response, fallback)` — **detecta si el blob contiene un JSON de
  error** (por ejemplo un `403`) y lo devuelve como mensaje en lugar de guardar
  un archivo corrupto.

Reportes envía a la exportación **los filtros del reporte ya mostrado**, de
modo que el PDF y el Excel coinciden fila a fila con la tabla (RF-08.6).

---

## 6. Autenticación y sesión

```
LoginPage ──► authService.login() ──► localStorage (access, refresh, user)
                                        │
AuthProvider (al montar) ──► GET /auth/me/ ──► user + permissions
                                        │
RequireAuth (guard) ◄──── isAuthenticated / loading
```

- Tokens en `localStorage` mediante `STORAGE_KEYS` (`sigacu.access`,
  `sigacu.refresh`, `sigacu.user`).
- `AuthProvider` valida la sesión al arrancar con `/auth/me/`.
- `logout()` revoca el refresh en el backend y limpia el almacenamiento.

> **Endurecimiento para producción (RNF-06):** mover el refresh token a una
> cookie `HttpOnly; Secure; SameSite=Strict` y mantener en memoria solo el
> access token. La capa de servicios está aislada para permitir ese cambio sin
> tocar las páginas. Mientras tanto, la XSS se mitiga no usando
> `dangerouslySetInnerHTML` y escapando todo lo que viene de la API.

---

## 7. Enrutamiento

`BrowserRouter` + `React.lazy` (cada página se descarga bajo demanda).

| Ruta | Módulo (permiso) | Requisito |
|---|---|---|
| `/login` | pública | RF-01 |
| `/` | `dashboard` | RF-08.5 |
| `/perfil` | `profile` | RF-02 |
| `/notificaciones` | `notifications` | RF-02.4, RF-10 |
| `/acceso/verificacion` | `access` | RF-04 |
| `/acceso/bitacora` | `access-log` | RF-04.5, RF-12 |
| `/solapines` | `credentials` | RF-03.5/03.6/03.10 |
| `/solapines/plantillas` | `credentials-templates` | RF-03.1/03.2 |
| `/visitantes/nueva` | `visitor-requests-new` | RF-05.1 |
| `/visitantes` | `visitor-requests` | RF-05.2–05.5 |
| `/vehiculos` | `vehicles` | RF-06 |
| `/incidencias` | `incidents` | RF-07 |
| `/reportes` | `reports` | RF-08 |
| `/admin/usuarios` | `admin-users` | RF-09.1/09.2 |
| `/admin/nomencladores` | `admin-catalogs` | RF-09.3 |
| `*` | — | `NotFoundPage` (404) |

Nginx devuelve `index.html` en cualquier ruta para soportar recargas.

---

## 8. Permisos (RBAC)

`src/config/permissions.js` es el **contrato** entre el backend
(`apps/usuarios/constants.py → Permission`) y la navegación. Cada módulo
declara los permisos que lo habilitan y basta con **uno**:

```js
hasPermission('access');        // AuthContext: usa user.permissions o '*'
visibleSections(user);          // menú filtrado
canAccess(user, 'reports');
```

Ejemplos actuales: `reports → ['reports:view', 'reports:export']`,
`access-log → ['access:view', 'access:export']`,
`admin-users → ['users:view', 'users:manage', 'roles:manage']`.

**La interfaz oculta o bloquea, pero el control autoritativo es del backend.**
Además, los botones de acción respetan el permiso específico: en Reportes los
botones de exportación solo se muestran con acceso al módulo `reports`.

### Añadir una pantalla

1. Cree la página en `src/pages/<dominio>/`.
2. Añada la entrada en `NAV_SECTIONS` (`src/config/navigation.js`) con su `module`.
3. Regístrela en `PROTECTED_ROUTES` (`src/routes/routes.config.jsx`).
4. Añada el endpoint en `src/services/index.js`.
5. Si es un módulo nuevo, declare su clave en `MODULE_PERMISSIONS`.
6. Verifique el permiso en el backend (`HasRole`/RBAC) y en `docs/RBAC.md`.

> Los módulos universitarios (estudiantil, académico, RRHH, mantenimiento,
> investigación y analítica) **no tienen pantalla** en la SPA: su API existe
> pero la interfaz está pendiente según el
> [roadmap](../docs/ROADMAP_MODULOS.md). No hay todavía pantallas «en
> preparación» registradas.

---

## 9. PWA y funcionamiento sin conexión

Configurada en `vite.config.js` con `vite-plugin-pwa` (Workbox):

- `manifest.webmanifest` con nombre «SIGACU - UHO», iconos 192/512/maskable y
  `display: standalone` (RF-04.6, RG-07).
- **App Shell precacheado** (JS/CSS/HTML/iconos): la app abre sin red.
- **La API nunca se cachea** (`NetworkOnly`): los datos de acceso cambian y una
  decisión de acceso no puede venir de caché. Se excluyen `/api`, `/admin`,
  `/media` y `/oauth`.
- Al compilar se generan `.gz` y `.br` por asset; el `vite preview` negocia
  gzip para medir el tamaño real en el móvil.
- Service worker con `autoUpdate` e `injectRegister: 'script'`.

**Cola offline (RNF-09):** `src/utils/offlineQueue.js` guarda las
verificaciones en IndexedDB con su `client_uuid` y la hora del escaneo (no la
de sincronización). La pantalla de Verificación muestra los pendientes y los
envía con `accessService.syncOffline(...)`; el backend descarta duplicados por
`client_uuid`. Cubierto por 3 pruebas (`npm test`).

**Cámara (RF-04.1):** `getUserMedia` solo existe en contextos seguros. En
`localhost` funciona; desde el móvil hay que usar HTTPS (túnel
`scripts/tuneles.sh`). Si no es seguro, la pantalla lo explica en lugar de
fallar en silencio.

---

## 10. Tiempo real

`useNotificationsSocket()` abre `ws(s)://<host>/ws/notifications/?token=<access>`
con reconexión exponencial (máx. 6 intentos, hasta 30 s) y *heartbeat* cada
25 s. `Topbar` usa el contador de no leídas; `/notificaciones` permite marcar
todas como leídas (RF-10.2).

---

## 11. Estilos y accesibilidad

- Tailwind con la paleta institucional (`brand` azul, `gold` dorado) en
  `tailwind.config.js`; componentes reutilizables en `src/index.css`
  (`btn-primary`, `card`, `input`, `label`, `badge-*`, `data-table`).
- Conflicto de clases resuelto con `cn()` (`clsx` + `tailwind-merge`).
- **Identidad (RG-05, RNF-11):** sustituya `brand`/`gold` y los iconos por los
  valores del Manual de Identidad de la UHO. **Estado: pendiente** de los
  recursos oficiales; la paleta actual es la de referencia del mockup.
- Accesibilidad (RNF-02): `label` asociado, `aria-label` en botones con icono,
  modales que cierran con `Escape`, foco visible, overlay del menú como
  `<button>`. Sin auditoría WCAG formal todavía.

---

## 12. Estado frente a los requisitos

| Requisito | Estado | Dónde |
|---|---|---|
| RF-01.1/01.2 Login y mensajes de AGA_AUTH | 🟡 | `LoginPage` + `authService`; el backend decide AGA real o mock |
| RF-01.5 Cerrar sesión | ✅ | Botón de cierre + `authService.logout()` |
| RF-01.6 Expiración por inactividad | 🟡 | Se aplica el vencimiento del token, no un temporizador de inactividad |
| RF-02.1/02.2 Perfil | ✅ | `ProfilePage` |
| RF-02.3 Ver y descargar solapín | ✅ | `ProfilePage` → `SolapinCard` (PNG final compuesto en el backend) |
| RF-02.4 Notificaciones leídas/no leídas | ✅ | `NotificationsPage`, `Topbar` |
| RF-02.5 Datos oficiales no editables | ✅ | El formulario de perfil solo permite lo que el backend autoriza |
| RF-03.1/03.2 Configurador de plantillas | ✅ | `PlantillasSolapinPage` (imagen base + zonas dinámicas) |
| RF-03.4 Generación masiva | 🟡 | Existe en la API; **la SPA no tiene botón de generación masiva** |
| RF-03.5 Buscar por CI/nombre | ✅ | `SolapinesPage` |
| RF-03.6 Cambio de nivel | 🟡 | El nivel se **muestra** en `SolapinesPage`/`ProfilePage`; **falta el control** para modificarlo (la API existe) |
| RF-03.8 Solapín temporal de visitante | 🟡 | Se genera al aprobar; **falta una pantalla explícita** para generarlo a mano con datos, área, motivo y vigencia |
| RF-03.10 Cancelar/reactivar | ✅ | `SolapinesPage` (cancelación con motivo y reactivación) |
| RF-04.1 Escaneo QR | ✅ | `VerificacionAccesoPage` (`QrScanner`) |
| RF-04.2 Buscar por CI/nombre | ✅ | `VerificacionAccesoPage` |
| RF-04.3 Ficha con datos | ✅ | `VerificacionAccesoPage` |
| RF-04.4/04.7 Permitido/denegado con alerta | ✅ | Resultado verde/rojo con motivo |
| RF-04.5 Registrar entrada/salida | ✅ | `VerificacionAccesoPage` |
| RF-04.6 PWA instalable | ✅ | `vite.config.js` (§9) |
| RF-04.8 Registrar incidencia desde verificación | ⬜ | Existe el módulo de incidencias, pero la pantalla de verificación **no ofrece registrar una incidencia desde la ficha** |
| RF-05.1 Crear solicitud | ✅ | `NuevaSolicitudVisitaPage` |
| RF-05.2/05.3/05.4 Historial, bandeja y decisiones | ✅ | `SolicitudesVisitaPage` |
| RF-05.5 Editar y reenviar | 🟡 | Solicitar cambios está en la bandeja; **no hay formulario de edición y reenvío** en la SPA (la API `PATCH …/estado/` existe) |
| RF-05.6/05.7 Notificación y descarga del solapín | ✅ | Notificaciones + `ProfilePage` del visitante |
| RF-06.1–06.5 Control vehicular | ✅ | `VehiculosPage` (verificación, entrada/salida, excepción con motivo, alerta) |
| RF-06.3 Vehículos autorizados CRUD | 🟡 | Existe en la API; **la SPA no tiene pantalla de catálogo de vehículos autorizados** |
| RF-06.7 Histórico con filtros | 🟡 | `VehiculosPage` lista los del día por sede; no hay filtro por placa/fecha |
| RF-07.1–07.5 Incidencias | 🟡 | `IncidenciasPage`: alta, listado y cambio de estado (En seguimiento / Cerrada). **No hay estadísticas ni seguimiento/comentarios** en la pantalla, aunque la API los expone |
| RF-08.1–08.4 Reportes con filtros | ✅ | `ReportesPage` |
| RF-08.5 Dashboard | ✅ | `DashboardPage` |
| RF-08.6 Exportar PDF/Excel | ✅ | `ReportesPage` y `BitacoraAccesoPage` |
| RF-09.1/09.2 Usuarios, roles y permisos | ✅ | `UsuariosPage` |
| RF-09.3 Nomencladores CRUD | 🟡 | `CatalogsPage` cubre sedes, unidades, puntos de control y entradas genéricas; el backend aún no tiene cargos/carreras/tipos de curso |
| RF-09.4 Identidad visual | ⬜ | Configuración de logo y colores por el administrador |
| RF-09.5 Configurar integraciones | ⬜ | Pantalla de parámetros de AGA_AUTH/SIGENU/ASSET |
| RF-09.6 Vista de auditoría | 🟡 | Existe la API (`/audit/events/`); **no hay pantalla** de logs en la SPA |
| RF-12.4 Filtrar por sede | ✅ | Sedes en dashboard, vehículos, reportes y bitácora |
| RNF-09 PWA + cola offline | ✅ | §9 |
| RNF-01 Mensajes en español | ✅ | `parseApiError` y toasts |
| RNF-11 Paleta/logo institucional | 🟡 | Paleta de referencia; logo oficial pendiente |

---

## 13. Calidad y verificación

| Comprobación | Comando | Resultado en la última revisión |
|---|---|---|
| Pruebas | `npm test` | **3 pruebas, 3 pasan** (cola offline) |
| Lint | `npm run lint` | **0 errores**, 5 avisos `react-hooks/exhaustive-deps` en páginas de datos |
| Compilación | `npm run build` | Correcta (genera PWA y `.gz`/`.br`) |

Las buenas prácticas aplicadas están detalladas en
[docs/BEST_PRACTICES.md](../docs/BEST_PRACTICES.md): estados obligatorios de
carga/vacío/error (`DataStates`), paginación del servidor, fechas en `es-CU`,
sin `dangerouslySetInnerHTML` y sin duplicar la matriz de roles.

**Pendiente de pruebas:** no hay pruebas de componentes ni E2E; la verificación
de la interfaz se hace hoy de forma manual con el backend en ejecución.

---

## 14. Docker (producción)

La imagen multi-etapa compila con Node 20 y sirve `dist/` con Nginx, que hace
proxy de `/api`, `/admin`, `/oauth`, `/static`, `/media` y `/ws` al servicio
`backend`.

```bash
npm run build                       # compilación local de verificación
docker build -t sigacu-frontend .   # imagen independiente
```

En el *stack* completo se usa `../docker/docker-compose.yml` (puerto 8080).

---

## 15. Solución de problemas

| Síntoma | Causa habitual | Solución |
|---|---|---|
| `401` en bucle y redirección al login | Refresh vencido o revocado | Inicie sesión de nuevo |
| Pantalla en blanco al recargar en producción | El servidor no devuelve `index.html` | Revise el `try_files` de Nginx |
| CORS bloqueado | `VITE_API_BASE_URL` apunta a otro origen | Use la ruta relativa `/api/v1` o añada el origen al backend |
| WebSocket en `disconnected` | Backend sin ASGI/Redis o token vencido | Revise el proxy `/ws` y `USE_REDIS_CHANNEL_LAYER` |
| La cámara no abre en el móvil | Contexto inseguro (HTTP por IP) | Use HTTPS con `scripts/tuneles.sh` |
| «Acceso restringido» en un módulo | El rol no incluye ese permiso | Habilítelo en el backend (`RoleDefinition`) |
| Un PDF descargado dice «No fue posible» | Permiso o sesión del backend | El mensaje real se muestra en el toast (`saveDownload`) |

Documentación general: [`../docs/`](../docs) —
[arquitectura](../docs/ARCHITECTURE.md), [API](../docs/API.md),
[RBAC](../docs/RBAC.md), [instalación](../docs/INSTALL_UBUNTU.md),
[Docker](../docs/INSTALL_DOCKER.md), [roadmap](../docs/ROADMAP_MODULOS.md).

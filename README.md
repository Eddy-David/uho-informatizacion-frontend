# Frontend — SIGACU · Universidad de Holguín

SPA empresarial construida con **React 18 + Vite 5 + Tailwind CSS 3**.
Consume la API REST de Django (`../backend`) mediante JWT y recibe notificaciones
en tiempo real por WebSocket (Django Channels).

---

## 1. Requisitos

| Componente | Versión |
|---|---|
| Node.js | 20 LTS (mínimo 18) |
| npm | 10+ |
| Backend en ejecución | `http://localhost:8000` |

Compruebe la versión:

```bash
node --version   # v20.x
npm --version
```

---

## 2. Ejecución

```bash
npm install

cp .env.example .env          # Windows cmd: copy .env.example .env
                              # Windows PS : Copy-Item .env.example .env

npm run dev
```

Abra <http://localhost:5173>. El proxy de Vite reenvía `/api`, `/media` y `/ws`
a `http://localhost:8000` (o a `VITE_PROXY_TARGET` si está definida), por lo que
en desarrollo no hay problemas de CORS.

> `VITE_PROXY_TARGET` es una variable **de Node** (la lee `vite.config.js` con
> `process.env`), por eso se define en el sistema o en la línea de comandos, no
> en el `.env` del cliente: `VITE_PROXY_TARGET=http://127.0.0.1:8000 npm run dev`.

### Variables del cliente (`.env`)

Solo las variables con prefijo `VITE_` llegan al navegador. Consulte
[`.env.example`](.env.example).

| Variable | Por defecto | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | URL base de la API |
| `VITE_APP_NAME` | `SIGACU` | Nombre visible de la aplicación |
| `VITE_INSTITUTION_NAME` | `Universidad de Holguín` | Pie de barra lateral |
| `VITE_APP_VERSION` | `1.0.0` | Versión mostrada |
| `VITE_WS_URL` | *(deducida)* | URL del WebSocket (`ws://host/ws`) |

> ⚠️ **Nunca** coloque secretos con prefijo `VITE_`: todo lo que empiece por
> `VITE_` se incluye en el bundle y es público.

---

## 3. Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente (puerto 5173) |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run preview` | Sirve la compilación localmente para verificarla |
| `npm run lint` | ESLint sobre `src/` |
| `npm run format` | Prettier sobre `src/**/*.{js,jsx,css}` |

Antes de cada *commit*: `npm run lint && npm run build`.

---

## 4. Estructura

```
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── layout/               # AppLayout, Sidebar, Topbar, PageHeader
│   │   └── ui/                   # Icon, Modal, Toast, StatCard, StatusBadge,
│   │                             # DataStates (Loading / Empty / Error / Skeleton)
│   ├── config/
│   │   ├── env.js                # Lectura de import.meta.env
│   │   └── navigation.js         # Menú, canAccess, visibleSections
│   ├── features/
│   │   ├── auth/                 # AuthContext, AuthProvider, authService, storage
│   │   └── notifications/        # useNotificationsSocket (reconexión + heartbeat)
│   ├── pages/                    # Una carpeta por módulo funcional
│   │   ├── auth/                 # LoginPage
│   │   ├── dashboard/            # DashboardPage (KPIs + gráficos)
│   │   ├── access/               # AccessVerificationPage, AccessLogPage
│   │   ├── credentials/          # BadgesPage, BadgeTemplatesPage (app backend: solapines)
│   │   ├── visitors/             # NewVisitPage, VisitRequestsPage
│   │   ├── vehicles/             # VehiclesPage
│   │   ├── incidents/            # IncidentsPage
│   │   ├── reports/              # ReportsPage
│   │   ├── admin/                # UsersPage, CatalogsPage
│   │   ├── profile/              # ProfilePage
│   │   ├── notifications/        # NotificationsPage
│   │   └── coming-soon/          # Módulos futuros (estudiantil, RRHH, IA, …)
│   ├── routes/
│   │   ├── AppRoutes.jsx         # Rutas, lazy loading y registro por módulo
│   │   └── guards.jsx            # RequireAuth, RequirePermission, FullPageLoader
│   ├── services/
│   │   ├── api.js                # Instancia Axios + interceptores JWT
│   │   └── index.js              # Servicios por dominio
│   ├── utils/                    # cn, formatDate, statusClass, downloadBlob, …
│   ├── index.css                 # Tailwind + componentes (@layer)
│   └── main.jsx                  # Punto de entrada
├── nginx/default.conf            # SPA + proxy /api y /ws (imagen de producción)
├── Dockerfile                    # Producción: build + Nginx
├── Dockerfile.dev                # Desarrollo con recarga
├── .eslintrc.cjs
├── tailwind.config.js
├── vite.config.js
└── package.json
```

**Regla de oro:** `src/` solo contiene código de interfaz. No hay lógica de
negocio duplicada; las reglas (roles, estados, validaciones de dominio) viven en
el backend y llegan al cliente como datos.

---

## 5. Capa de servicios

### `src/services/api.js`

Instancia central de Axios con tres responsabilidades:

1. **Adjuntar el JWT** (`Authorization: Bearer <access>`) desde
   `localStorage[STORAGE_KEYS.access]` en cada petición.
2. **Renovar el token ante un `401`**: si hay `refresh`, llama a
   `/auth/token/refresh/` una sola vez (`isRefreshing`) y encola las peticiones
   concurrentes en `pendingQueue`; al responder, las reintenta con el nuevo
   token. Si el refresh falla, limpia la sesión y redirige a `/login`.
   Si la API rota el refresh, guarda el nuevo.
3. **Normalizar errores**: `parseApiError(error)` devuelve un mensaje legible a
   partir de la estructura `{ error: { code, message, details } }` del backend,
   priorizando el primer error de campo.

### `src/services/index.js`

Servicios por dominio que devuelven datos ya desenvueltos (`response.data`),
de modo que los componentes no conocen Axios:

```js
import { accessService, reportService } from '@/services';

const { count, results } = await accessService.logs({ result: 'DENEGADO', page: 1 });
```

| Servicio | Dominio |
|---|---|
| `coreService` | Salud, metadatos, sedes, áreas, puntos de control, nomencladores |
| `authService` | Login, logout, perfil, contraseña, roles (en `features/auth`) |
| `userService` | Usuarios, estadísticas, activación, restablecimiento |
| `accessService` | Verificación, sincronización offline, bitácora, KPIs |
| `credentialService` | Mi solapín, verificación, plantillas, solapines, lotes |
| `visitorService` | Solicitudes, aprobación/rechazo, visitantes dentro |
| `vehicleService` | Catálogo autorizado, verificación de placa, movimientos |
| `incidentService` | Incidencias, cambios de estado, seguimiento |
| `notificationService` | Bandeja, no leídas, marcar leídas |
| `reportService` | Panel, tipos, generación y exportación (Excel/PDF como blob) |

Los parámetros vacíos se omiten con `clean()`, y los errores se traducen con
`parseApiError` en cada página.

### Descargas de archivos

Las exportaciones llegan como `blob` (`responseType: 'blob'`) y se guardan con
`downloadBlob(...)` + `filenameFromDisposition(...)` (leyendo
`Content-Disposition`), preservando el nombre generado por el servidor.

---

## 6. Autenticación y sesión

```
LoginPage ──► authService.login() ──► localStorage (access, refresh, user)
                                        │
AuthProvider (al montar) ──► GET /auth/me/ ──► user + permissions
                                        │
RequireAuth (guard) ◄──── isAuthenticated / loading
```

- Los tokens se guardan en `localStorage` mediante `STORAGE_KEYS`
  (`sigacu.access`, `sigacu.refresh`, `sigacu.user`).
- `AuthProvider` valida la sesión al arrancar con `/auth/me/`, de modo que un
  token revocado no deja la interfaz en un estado inconsistente.
- `logout()` revoca el refresh en el backend y limpia el almacenamiento.

> **Endurecimiento para producción:** para reducir el riesgo de XSS se
> recomienda migrar el refresh token a una cookie `HttpOnly; Secure; SameSite=Strict`
> emitida por el backend y mantener en memoria solo el access token. La capa de
> servicios está aislada para permitir ese cambio sin tocar las páginas.

---

## 7. Enrutamiento

`BrowserRouter` + `Suspense` con `React.lazy`: cada página se descarga bajo
demanda, lo que mantiene pequeño el bundle inicial.

- `/login` — pública.
- Resto de rutas — dentro de `RequireAuth` + `AppLayout`.
- Cada ruta declara su `module` y se envuelve en `RequirePermission`.
- Ruta desconocida → `/404`. Nginx devuelve `index.html` en cualquier ruta para
  soportar recargas (ver `nginx/default.conf`).

---

## 8. Permisos (RBAC)

Los módulos visibles se controlan con `user.permissions`, que el backend incluye
en `GET /auth/me/` y en el payload del JWT:

```js
// AuthContext
hasPermission('access');        // true si el rol incluye el módulo o '*'

// config/navigation.js
visibleSections(user);          // secciones y elementos permitidos
canAccess(user, 'reports');
```

**La interfaz oculta o bloquea, pero el control autoritativo es del backend.**
Un usuario que fuerce una ruta verá «Acceso restringido» y, si intenta llamar a
la API, recibirá `403`.

### Añadir una pantalla o módulo

1. Cree la página en `src/pages/<dominio>/`.
2. Añada la entrada en `NAV_SECTIONS` (`src/config/navigation.js`) con su `module`.
3. Regístrela en `PROTECTED_ROUTES` (`src/routes/AppRoutes.jsx`).
4. Añada el endpoint en `src/services/index.js`.
5. Habilite el módulo para los roles correspondientes en
   `backend/apps/usuarios/models.py` (`ROLE_MODULES`) o en la base de datos
   (campo `Role.permissions`).
6. Añada el permiso en `backend/apps/usuarios/constants.py` (`Permission`) y
   proteja la vista con `HasPerm`.

Los módulos futuros (gestión estudiantil, procesos académicos, RRHH,
mantenimiento, proyectos de investigación, analítica e IA) ya están dados de
alta como **rutas protegidas con pantalla «en preparación»**
(`src/pages/coming-soon/ComingSoonPage.jsx`). Al implementarlos solo hay que
sustituir el elemento de la ruta y consumir su servicio.

---

## 9. Tiempo real

`useNotificationsSocket()` abre
`ws(s)://<host>/ws/notifications/?token=<access>`, con:

- reconexión exponencial (máx. 6 intentos, retroceso hasta 30 s);
- *heartbeat* cada 25 s (`{"action":"ping"}`) para mantener viva la conexión;
- cierre ordenado al desmontar o cerrar sesión.

`Topbar` lo usa para incrementar el contador de no leídas; al abrir
`/notificaciones` se consulta `unread_count` y se pueden marcar todas como leídas.

---

## 10. Estilos

Tailwind con la paleta institucional (`brand`, `gold`) en `tailwind.config.js`
y componentes reutilizables en `src/index.css`: `btn-primary`, `card`, `input`,
`label`, `badge-*`, `data-table`, `page-title`, `kpi-value`. Los conflictos de
clases se resuelven con `cn()` (`clsx` + `tailwind-merge`).

**Identidad visual:** sustituya `brand` y `gold` por los valores del Manual de
Identidad de la UHO y actualice `public/favicon.svg`.

---

## 11. Calidad y buenas prácticas

- Componentes funcionales y hooks; un componente por archivo en `PascalCase`.
- Estados obligatorios en cada vista de datos: **cargando**, **vacío** y **error**
  (`components/ui/DataStates.jsx`).
- Accesibilidad: `label` asociado, `aria-label` en botones con icono, cierre de
  modales con `Escape`, foco visible, overlay del menú como `<button>`.
- Sin `dangerouslySetInnerHTML` para datos del usuario (prevención de XSS).
- Fechas formateadas con `formatDate`/`formatDateTime` (`es-CU`).
- Paginación controlada por el servidor (`page`, `page_size`).
- No duplicar la matriz de roles en el cliente: se consume del backend.

---

## 12. Docker (producción)

La imagen multi-etapa compila con Node 20 y sirve el resultado con Nginx, que
además hace proxy de `/api`, `/admin`, `/oauth`, `/static`, `/media` y `/ws`
al servicio `backend`.

```bash
npm run build                       # compilación local de verificación
docker build -t sigacu-frontend .   # imagen independiente
```

En el *stack* completo se usa `docker/docker-compose.yml` (puerto 8080).

---

## 13. Solución de problemas

| Síntoma | Causa habitual | Solución |
|---|---|---|
| `401` en bucle y redirección al login | Refresh vencido o revocado | Inicie sesión de nuevo; revise `JWT_REFRESH_TOKEN_LIFETIME_DAYS` |
| Pantalla en blanco tras recargar en producción | El servidor no devuelve `index.html` | Revise el `try_files` de Nginx |
| CORS bloqueado | `VITE_API_BASE_URL` apunta a otro origen | Añada el origen a `CORS_ALLOWED_ORIGINS` o use el proxy de Vite |
| WebSocket en `disconnected` | Backend sin ASGI/Redis o token vencido | Revise `/ws/` en el proxy y `USE_IN_MEMORY_CHANNEL_LAYER` |
| «Acceso restringido» en un módulo | El rol no incluye ese permiso | Habilítelo en `ROLE_MODULES`/`Role.permissions` |
| `npm install` falla en Windows | PowerShell restringido | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

Documentación general: [`../docs/`](../docs)
([arquitectura](../docs/ARCHITECTURE.md), [API](../docs/API.md),
[instalación Windows](../docs/INSTALL_WINDOWS.md),
[Docker](../docs/INSTALL_DOCKER.md), [buenas prácticas](../docs/BEST_PRACTICES.md)).

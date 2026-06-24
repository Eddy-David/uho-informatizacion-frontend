# SIGACU – Sistema de Gestión de Acceso al Campus Universitario (UHO)

Este sistema constituye una plataforma modular institucional diseñada para soportar los procesos clave de control de acceso en la Universidad de Holguín, incluyendo:

· Gestión de identidad mediante Solapín Digital (plantillas, generación automática y manual, niveles de acceso)
· Control de acceso físico de personas y vehículos en las cuatro sedes
· Verificación por escaneo de código QR o por CI/nombre
· Gestión de visitantes y solicitudes de visita con flujo de aprobación configurable
· Control vehicular: registro de movimientos y catálogo de vehículos autorizados
· Registro de incidencias en los puntos de acceso
· Reportes y estadísticas por sede, fecha, tipo de usuario y evento
· Administración centralizada de usuarios, roles, permisos y nomencladores

## Objetivo General

Proveer una arquitectura escalable, segura y adaptable para el control de acceso en las cuatro sedes de la UHO, integrando los registros primarios institucionales (SIGENU y ASSET) y el sistema de autenticación centralizada (AGA_AUTH), permitiendo la gestión eficiente de solapines digitales, verificación por QR, registro de eventos de acceso, movimientos vehiculares e incidencias, así como la generación de reportes y la interoperabilidad mediante una API REST propia para el resto del ecosistema UHO.

## Arquitectura

El sistema está compuesto por:

· Backend Django REST Framework
· Frontend React + Vite + Tailwind
· Base de datos PostgreSQL
· MinIO para almacenamiento de imágenes y plantillas de solapines
· Docker para despliegue
· GitLab CI/CD para integración continua

Además, SIGACU se integra con AGA_AUTH (autenticación), SIGENU (datos de estudiantes) y ASSET (datos de trabajadores), y expone una API REST documentada con OpenAPI/Swagger.

## Modularidad

Cada módulo funcional se implementa como una app independiente en Django y como una sección autónoma en el frontend React. Los módulos principales son: Autenticación y sesión, Perfil de usuario, Solapín Digital (configuración y gestión), Control de acceso (verificación), Gestión de visitantes, Control vehicular, Incidencias, Reportes y estadísticas, Administración (usuarios, roles, nomencladores, configuración) y Notificaciones.

## Seguridad

El sistema utiliza JWT para la gestión de sesiones propia y delega la validación de credenciales en AGA_AUTH. Emplea RBAC (Role-Based Access Control) para la asignación granular de permisos por módulo y acción, con roles predefinidos (Superadministrador, Administrador, Director de Seguridad, Personal de Seguridad, Aprobador de Visitas, Cuadro, y usuarios generales). Toda comunicación viaja cifrada mediante HTTPS/TLS y se aplican medidas de mitigación contra vulnerabilidades comunes (inyección, XSS, CSRF, control de acceso roto).

## Auditoría y Backups

Incluye un middleware de auditoría que registra todas las acciones relevantes (inicios de sesión, generación/cancelación de solapines, cambios de nivel de acceso, decisiones sobre solicitudes, registros de acceso, movimientos vehiculares, incidencias, modificaciones en nomencladores y roles) con trazabilidad de usuario, módulo, acción, fecha/hora y sede. Además, se implementan scripts automáticos de respaldo de la base de datos PostgreSQL para garantizar la recuperación ante fallos.

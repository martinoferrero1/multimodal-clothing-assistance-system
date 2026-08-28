## Why

Lookeate solo modela identidades personales, por lo que no puede incorporar tiendas de forma segura ni separar sus datos y privilegios. Se necesita un ciclo de alta comercial verificable y aprobado, con autorización multi-tenant que impida el acceso entre tiendas.

## What Changes

- Definir un registro público de tiendas que queda en estado `pending` hasta que el correo se verifica, el propietario completa MFA o step-up y una aprobación manual la activa.
- Añadir las entidades comerciales `Store` y `StoreMembership`, manteniendo `ChatUser` como identidad humana y permitiendo a una persona administrar varias tiendas.
- Incorporar los estados de tienda `pending`, `active`, `rejected` y `suspended`, junto con el único rol inicial `owner` y restricciones que preserven la titularidad.
- Crear el alta transaccional que crea usuario, tienda y membership `owner`, y emite una sesión únicamente tras confirmar toda la operación; no promocionará automáticamente a un guest existente.
- Añadir verificación de correo mediante tokens hasheados, de un solo uso y expirables, aprobación administrativa, revocación de privilegios y sesiones al rechazar o suspender una tienda.
- Extender la autorización de servidor para resolver la tienda y membership desde la sesión, exigir rol y estado elegibles, y rechazar accesos cross-tenant o `store_id` no autorizado del cliente.
- Exponer endpoints protegidos contra enumeración, CSRF y abuso para registro, estado, verificación y aprobación de tiendas a través del BFF same-origin.
- Añadir onboarding diferenciado para cuenta personal y tienda, con validación de formulario y pantallas de verificación, aprobación, rechazo y suspensión sin guardar secretos en Web Storage.
- Documentar auditoría, métricas, transferencia de ownership, backup y recuperación de datos comerciales.

## Capabilities

### New Capabilities
- `store-identity`: entidades comerciales, memberships, estados y reglas de ownership multi-tienda.
- `store-registration`: registro público de tiendas, verificación de correo, MFA o step-up y aprobación antes de la activación.
- `store-authorization`: resolución de tenant y autorización de memberships exclusivamente en el servidor.
- `store-onboarding`: experiencia web para registrar una tienda y comunicar su estado de activación.

### Modified Capabilities
- `web-session-authentication`: condicionar sesiones y privilegios comerciales al estado de tienda, membership, verificación y step-up elegibles.
- `api-abuse-protection`: incorporar presupuestos específicos de rate limiting para el registro y verificación de tiendas.
- `schema-migrations`: exigir una migración recuperable que introduzca datos comerciales sin perder usuarios existentes.
- `recovery-operations`: incluir datos comerciales y recuperación de ownership en los procedimientos operativos.

## Impact

- Backend de autenticación, sesiones, autorización, modelos SQLAlchemy, Alembic, dependencias FastAPI y BFF Next.js.
- Nuevos endpoints bajo `/api/auth/store/` y controles administrativos de aprobación, con las protecciones actuales de cookies, CSRF, origen y respuestas no enumerables.
- Frontend de autenticación y nuevas superficies de onboarding/estado comercial.
- Configuración de correo, MFA o step-up, auditoría, métricas y límites compartidos en entornos desplegados.
- Pruebas de migración, transacciones, autorización tenant, sesiones y flujos end-to-end; documentación de operación y recuperación.

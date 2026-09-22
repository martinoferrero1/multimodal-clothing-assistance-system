# Lookeate mobile

Aplicación independiente de **React Native + Expo SDK 57**, para Android e iOS.
Comparte el backend FastAPI de Lookeate; tiene dependencias, navegación,
configuración y componentes propios. No importa código del frontend Next.js.

## Ejecutar en un teléfono

Requisitos: Node.js 22.13 o posterior, npm y Expo Go compatible con SDK 57.
El teléfono y la computadora deben poder conectarse por la red local.

```bash
cd mobile
npm ci
cp .env.example .env
# Editar EXPO_PUBLIC_API_URL con la IP LAN de la computadora.
npm start
```

En Windows se pueden ejecutar estos comandos con Git Bash. En PowerShell,
usar `npm.cmd` / `npx.cmd` si la política de ejecución bloquea los wrappers `.ps1`.
Escanear el QR de Expo desde Android o desde la cámara del iPhone.

El backend debe estar inicializado según el `AGENTS.md` raíz y escuchar en una
interfaz accesible al teléfono:

```bash
APP_ENV=local PYTHONPATH=src uvicorn api.app:app --host 0.0.0.0 --port 8000
```

Este último comando se ejecuta desde la raíz del repositorio. Las migraciones,
PostgreSQL, los proveedores de IA y el checkpointer mantienen sus requisitos
existentes. La app no necesita que Next.js esté iniciado cuando se conecta
directamente con FastAPI.

| Entorno           | `EXPO_PUBLIC_API_URL`                                |
| ----------------- | ---------------------------------------------------- |
| Teléfono físico   | `http://IP-LAN-DE-TU-PC:8000`                        |
| Emulador Android  | `http://10.0.2.2:8000`                               |
| Simulador iOS     | `http://localhost:8000`                              |
| Release / staging | URL HTTPS del backend accesible desde el dispositivo |

`EXPO_PUBLIC_APP_ORIGIN` debe coincidir exactamente con una entrada existente
en `ALLOWED_ORIGINS` del backend. En local suele ser `http://localhost:3000`;
es metadata del contrato de solicitudes, no la dirección de Metro.
`EXPO_PUBLIC_SESSION_COOKIE_NAME` debe coincidir con `SESSION_COOKIE_NAME`.
Una compilación release exige HTTPS y un nombre de cookie con prefijo `__Host-`.
Todas las variables `EXPO_PUBLIC_*` son públicas: no incluir claves de IA,
contraseñas ni secretos del servidor.

`npm run android` abre un emulador ya configurado. `npm run ios` requiere
macOS para el simulador. Windows puede servir Metro a un iPhone con Expo Go.
`npm run web` ofrece una **vista de desarrollo de la interfaz**, no un tercer
cliente autenticado: la sesión nativa usa SecureStore y se prueba en Android/iOS.
La web completa existente sigue en `src/frontend`.

## Funcionalidades adaptadas

| Módulo             | Implementación mobile                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inicio             | Identidad oscura/lavanda, tipografía editorial, Beta global y navegación inferior                                                                            |
| Cuenta             | Registro personal, login, restauración, expiración, logout y logout global                                                                                   |
| Lookeate Assistant | Historial, crear, renombrar, fijar, ordenar y eliminar conversaciones; mensajes y Markdown; cámara/galería; prendas y outfits; preferencias por conversación |
| Crear estilo       | Mismas prendas base de la web, selección por categoría, capas, resumen temporal y maniquí vectorial con giro por gesto y controles accesibles                |
| Catálogo           | Búsqueda, categorías, subcategorías, marcas, orden, filtro de vistas de prueba, búsqueda por foto, paginación y detalle con distintas imágenes               |
| Favoritos          | Persistencia local en el dispositivo, igual que el alcance local de favoritos web                                                                            |
| Configuración      | Español/inglés, densidad del chat, recomendaciones, prioridades, preferencias explícitas e inferidas de estilo                                               |
| Noticias           | Misma selección editorial estática de la web, categorías y apertura de fuentes                                                                               |
| Comunidad          | Publicaciones, filtros, suscripciones e ingreso por invitación para cuentas personales                                                                       |
| Tiendas            | Registro, verificación, estado, MFA, inventario CRUD/importación JSON con revisión y publicaciones CRUD                                                      |
| Creador de prendas | Visible como próximo módulo, sin acción habilitada                                                                                                           |

La navegación de conversaciones pertenece al Assistant. Los outfits se abren
en modales de pantalla completa. La preferencia de recomendaciones controla su
visibilidad; no existe un panel lateral en el teléfono. El maniquí es una
representación vectorial con transformación de perspectiva, no un motor de
prueba virtual ni un modelo corporal 3D. Los looks no se guardan en el servidor.

`src/core/types.ts`, `i18n.ts`, `fashion-news.ts` y `garments.ts` contienen una
copia inicial de contratos/contenidos del frontend. Mantenerlos sincronizados
al cambiar la API o el contenido editorial. La independencia permite extraer
esta carpeta a otro repositorio sin depender de archivos hermanos.

## Sesiones y datos

Se conserva la sesión opaca revocable del backend, sin nuevos endpoints, tokens
JWT ni cambios de esquema. `expo/fetch` envía explícitamente la cookie y el
encabezado CSRF; el almacenamiento automático de cookies está deshabilitado.
Solo se acepta la cookie configurada y se guarda en Expo SecureStore, con
separación por endpoint. La contraseña y el CSRF no se persisten. Los redirects
del transporte se rechazan para evitar trasladar credenciales a otro destino.

Un 401 borra la credencial y desmonta las pantallas protegidas; una falla de red
o un 403 no simulan revocación. Las solicitudes atrasadas de una sesión anterior
no pueden invalidar una sesión nueva. Los favoritos y preferencias de interfaz
usan AsyncStorage y son locales al dispositivo. La autorización de recursos y
el estado comercial siempre se verifican en FastAPI.

## Verificación

```bash
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run export:native
npx expo install --check
npx expo-doctor
npm audit
```

Los tests ejercitan el contrato de cookies/CSRF, expiración, logout, carreras
entre sesiones, multipart y rechazo de configuración insegura de release.
`expo export` comprueba la generación de bundles, **no produce un APK/IPA
firmado ni reemplaza las pruebas en un teléfono**.

Antes de distribuir: ejecutar la matriz en `VALIDATION.md` sobre Android e iOS,
confirmar identificadores definitivos de la aplicación, configurar un backend
HTTPS y realizar el build nativo con las cuentas/certificados del proyecto.
No se publicaron builds ni se configuró un proveedor de distribución.

Referencias: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

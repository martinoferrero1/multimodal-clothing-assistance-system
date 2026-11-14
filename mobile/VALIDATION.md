# Evidencia de implementación

Verificación de la refactorización realizada el 4 de noviembre de 2026.
Referencia web: `origin/main` en `b54394bd`. Comparación por sección y decisiones
en [PARITY_REVIEW.md](PARITY_REVIEW.md).

| Control | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto |
| `npm run lint` | Correcto, sin advertencias |
| `npm test` | 11 pruebas de transporte/configuración, recomendaciones y fechas aprobadas |
| `npm run test:ui` | 17 pruebas de interfaz aprobadas en Chromium, con API simulada |
| `npm run export:native` | Bundles Hermes de Android e iOS generados |
| `npx expo install --check` | Versiones compatibles |
| `npx expo-doctor` | 21/21 controles aprobados |
| `npm audit --omit=dev` | 13 alertas: 2 bajas, 9 moderadas y 2 altas; ninguna crítica |

Se inspeccionaron capturas de inicio, catálogo, estilo, Around, comunidad,
outfits, configuración y tienda. La navegación se ejercitó a 320 × 740,
390 × 844, 768 × 1024 y 844 × 390, en español e inglés. Las capturas se generan
en `test-results/`, ignorado por Git. La variante web de React Native se usa
para verificar componentes y estado; no se afirma equivalencia visual perfecta
con el renderizador nativo.

Las pruebas recorren filtros/errores/reintentos, favoritos persistentes,
Around y búsqueda sin acentos, noticias, comunidad/suscripciones, alternativas
de recomendaciones, preferencias del chat, edición de tienda, registro,
login/logout y expiración. El transporte de prueba sólo se resuelve en web al
iniciar Metro con `LOOKEATE_UI_TEST=1`. Los bundles nativos usan el cliente real.
No se ejercitaron SecureStore, cámara, permisos, MFA ni sesiones reales de
FastAPI en un teléfono; esa validación continúa pendiente.

Las alertas altas residuales corresponden a `zod@3.25.76` y su consumidor
`@expo/cli`. El advisory `GHSA-mrhx-c7xc-m3w5` exige una versión de otra rama
mayor; no se forzó un override incompatible del SDK. Las otras alertas se
concentran en herramientas transitivas de Expo (`glob`, `minimatch`,
`deepmerge` y consumidores). Actualizar el SDK/herramientas con compatibilidad
validada antes de distribución. El estado inicial tenía 17 alertas de
producción, incluida una crítica; se resolvieron las actualizaciones compatibles.

El alcance es el nuevo cliente mobile. El backend y el frontend web existentes
no fueron modificados. No se crearon ni aprobaron artefactos OpenSpec.

## Revisión de identidad

Decisión: reutilizar la sesión del servidor, almacenando su cookie opaca en
SecureStore para el cliente nativo. Se evita agregar un segundo mecanismo de
autenticación. El transporte envía Origin y CSRF a los mismos endpoints y
rechaza redirects. La alternativa de cookies implícitas de React Native tiene
diferencias entre plataformas; aquí se utiliza el control explícito de
`expo/fetch`. El código nativo de Expo instalado fue revisado para verificar
que `credentials: omit` deshabilita los cookie jars automáticos en Android/iOS.

Los tests de `tests/transport.test.ts` verifican sesión, expiración, logout,
rechazo CSRF, aislamiento de credenciales y respuestas tardías. Las reglas de
ownership, guest promotion y privilegios del servidor no cambian. La aplicación
no presenta usuarios anónimos como invitados autenticados: el backend actual no
ofrece un flujo guest para consumir desde este cliente.

Se consultó `documentation/identity_guest_environments_plan.md` junto con los
contratos implementados, los AGENTS y la skill de revisión de identidad. El
alcance mantiene la sesión nativa existente y corrige el reinicio de navegación
por identidad; no implementa nuevos estados guest ni cambios de servidor.

## Entornos y distribución

| Entorno           | Conexión                                      | Almacenamiento              | Evidencia requerida                                |
| ----------------- | --------------------------------------------- | --------------------------- | -------------------------------------------------- |
| Local con Expo Go | HTTP explícito permitido con `__DEV__`        | SecureStore del dispositivo | Probar teléfono conectado al backend local         |
| Tests             | Fetch y almacén inyectados, sin claves reales | En memoria                  | `npm test`                                         |
| Staging / release | HTTPS y cookie `__Host-` obligatorios         | SecureStore                 | Bundle, build firmado, prueba con servidor staging |

Los identificadores `com.lookeate.mobile` son iniciales; confirmar titularidad
antes de publicar. Los permisos se solicitan al usar la cámara/galería. No se
solicita audio ni se incluyen secretos en la configuración pública.

## Prueba manual pendiente en Android e iOS

- Registro/login, cierre y reapertura, expiración y revocación desde otro dispositivo.
- Logout exitoso y con servidor sin conexión; intento CSRF inválido rechazado.
- Cambiar entre dos cuentas y comprobar que no sobreviven chats/datos protegidos.
- Enviar texto, cancelar selector, denegar cámara, adjuntar varias imágenes;
  comprobar límites de subida del servidor y errores de conexión sin reenvío automático.
- Abrir conversación con historial largo, recomendaciones/outfits y teclado;
  verificar composer con notch, gesto de inicio, pantalla pequeña y rotación.
- Catálogo, filtros, búsqueda por foto, paginación, favoritos después de reiniciar.
- Guardar preferencias explícitas/inferidas y por chat; cambiar idioma.
- Registrar tienda, verificar email, revisar estados y MFA; CRUD/importación y
  permisos de inventario/comunidad rechazados para cuentas no comerciales.
- VoiceOver/TalkBack, texto ampliado y selección/giro del maniquí.

Las pruebas del servidor, migraciones y build de Next.js no se repiten porque
esta implementación no modifica esos proyectos. Los controles del nuevo cliente
se registran en la entrega; la publicación requiere completar la prueba física.

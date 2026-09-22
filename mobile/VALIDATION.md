# Evidencia de implementación

Verificación realizada el 19 de septiembre de 2026:

| Control | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto |
| `npm run lint` | Correcto, sin advertencias |
| `npm test` | 8 pruebas de transporte/configuración aprobadas |
| `npm run test:ui` | 4 pruebas de interfaz aprobadas en Chromium |
| `npm run export:native` | Bundles Hermes de Android e iOS generados |
| `npx expo install --check` | Versiones compatibles |
| `npx expo-doctor` | 21/21 controles aprobados |
| `npm audit --omit=dev` | 0 vulnerabilidades |

Se inspeccionaron capturas de inicio y creador de estilos a 390 × 844 y se
comprobó la navegación a 320 px. Las pruebas de interfaz verifican selección de
prendas, giro del maniquí, idioma persistente y validación del formulario. No
ejercitan SecureStore ni una sesión real de FastAPI. No había emulador Android
ni simulador iOS instalado; no se afirma validación nativa de extremo a extremo.

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

El documento `documentation/identity_guest_environments_plan.md` referenciado
por las instrucciones no está presente en este checkout. Se usaron los contratos
implementados, los AGENTS y las skills locales como evidencia disponible.

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

# Revisión de paridad mobile / main

Revisión: 4 de noviembre de 2026. Referencia: `origin/main` actualizado mediante
`git fetch origin main`, commit `b54394bd60d49211d6a8110a45907d6d2511396e`.
La implementación anterior de mobile era `b18e8330`.

La comparación se hizo contra las rutas y los componentes reales de main:
algunas notas del AGENTS raíz todavía describen el catálogo como futuro, pero
la web de referencia ya permite usarlo. No se modificaron backend, Next.js,
artefactos OpenSpec ni datos locales existentes.

## Secciones y adaptación

| Sección web | Mobile después de la revisión |
| --- | --- |
| Inicio | Identidad editorial oscura/lavanda, Beta global, Assistant destacado, tarjetas de módulos en una columna, noticias destacadas, Around y comunidad. |
| Lookeate Assistant | Historial propio; crear, renombrar, fijar, ordenar y eliminar conversaciones. Acciones contraíbles y renombrado en modal. |
| Conversación | Texto, Markdown, cámara/galería, grupos de productos, outfits y preferencias por conversación. Se conservan las alternativas junto a la mejor coincidencia, sin duplicados. |
| Crear estilo | Misma selección base de prendas, categorías, búsqueda y capas. Maniquí compacto, giro con gesto/controles y resumen del look en modal. |
| Catálogo | Búsqueda, categorías/subcategorías/tipos, marcas, orden, vista de prueba, búsqueda por foto y paginación. Filtros en modal y restablecimiento explícito. Ruta tipada capaz de recibir una consulta inicial. |
| Detalle de producto | Imágenes seleccionables con etiquetas traducidas, atributos, precio y favorito. Imagen adaptada a la altura disponible. |
| Favoritos | Listado con contador, eliminación directa y acceso al catálogo desde el estado vacío. Persistencia local como en web. Acceso desde la cabecera y Más. |
| Noticias | Mismo contenido editorial, categorías estables al cambiar idioma, lectura de la noticia destacada elegida y apertura de su fuente. |
| Lookeate Around | Incorporado desde main: globo geográfico, giro, zoom, búsqueda sin acentos, Argentina/Estados Unidos, las 74 ubicaciones y los seis perfiles con paleta, materiales, silueta y sugerencias. |
| Comunidad | Búsqueda por texto/tienda/ubicación añadida; blogs, eventos, espacios, suscripciones e ingreso por invitación. Invitación en modal y fechas según idioma. |
| Configuración | General, Assistant y Cuenta. Preferencias persistentes, prioridades, estilo explícito e inferido, borrado y cierre de sesiones. Formularios extensos contraíbles. |
| Cuenta | Registro/login, restauración, errores, expiración, logout y logout global existentes. El contenedor completo de navegación se reinicia al cambiar de identidad. |
| Tienda | Registro, verificación, estado y MFA existentes. Inventario CRUD/importación JSON y publicaciones CRUD con formularios separados. Atributos/imágenes agrupados; fechas locales legibles y validadas para eventos. |
| Creador de prendas | Visible como próximo módulo, sin habilitar una función que la web todavía no ofrece. |

## Correcciones relevantes

- El componente de navegación anterior conservaba rutas al cambiar su stack de
  cuenta. La clave ahora pertenece al contenedor completo y se eliminaron las
  acciones `goBack`/`replace` posteriores al cambio de identidad.
- Guardar preferencias de conversación actualiza el recurso local con la
  respuesta del servidor: reabrir el formulario ya no recupera valores viejos.
  También se pueden guardar antes del primer mensaje.
- La preferencia de recomendaciones controla su expansión inicial. Los outfits
  y el botón para desplegar productos siguen disponibles al desactivarla.
- El chat deja de forzar el scroll al final cuando se está leyendo más arriba.
- Noticias utiliza identificadores de categoría independientes del idioma.
- Los formularios de eventos convierten fecha/hora local al contrato ISO de la
  API; rechazan fechas inexistentes y un final anterior o igual al inicio.
- Los componentes compartidos contemplan texto que se ajusta, controles de
  al menos 44 px, márgenes seguros y formularios con teclado. La configuración
  anónima ya no anida una página desplazable dentro de otra.

## Decisión de identidad y evidencia

Se aplicó `.agents/skills/lookeate-review-auth-security/SKILL.md` y se consultó
`documentation/identity_guest_environments_plan.md`. El alcance es revisión de
regresión del cliente, sin introducir otra política de identidad.

Se conserva la credencial opaca en SecureStore, CSRF/Origin y autorización del
backend. No se agrega almacenamiento de credenciales web. La alternativa de
redirigir imperativamente después de cada mutación se descartó porque puede
dejar acciones sobre un navegador ya desmontado; la identidad controla el
reinicio del contenedor.

Las pruebas de transporte existentes cubren cookie/CSRF, expiración, fallas de
red, aislamiento de respuestas tardías, multipart y configuración de release.
Las nuevas pruebas de componentes ejercitan login/logout y expiración con API
simulada. **No equivalen a una validación de SecureStore, permisos, MFA ni
ownership contra FastAPI en Android/iOS.** Esa evidencia continúa pendiente.

## Adaptaciones deliberadas y límites

- La navegación móvil usa cinco pestañas y Más; los destinos secundarios siguen
  accesibles sin reproducir un sidebar de escritorio.
- Outfits y edición se presentan en modales. No existe un panel lateral en el
  teléfono. El contenido recomendado permanece accesible.
- El maniquí usa SVG con perspectiva; no es un motor 3D de prueba virtual. Los
  looks son temporales, igual que el alcance actual de la web.
- Around usa el mismo atlas, ubicaciones y contenido editorial de main; el
  selector textual ofrece una alternativa a los puntos pequeños del globo.
  Los perfiles son muestras editoriales, no clima ni tendencias en tiempo real.
- El cliente sigue siendo independiente de Next.js. Las copias editoriales y
  contratos requieren sincronización cuando cambie main.
- No se publicó una app ni se generó un APK/IPA firmado. La matriz manual de
  dispositivos permanece en `VALIDATION.md`.

## Dependencias

Se actualizaron Expo a `~57.0.31`, DocumentPicker a `~57.0.3` e ImagePicker a
`~57.0.20`, dentro del SDK existente. Se agregaron las bibliotecas geográficas
que utiliza main. Se actualizaron dependencias compatibles de Markdown y
herramientas (`markdown-it`, `shell-quote`, `node-forge`, `source-map-js`).
No se aplicó `npm audit fix --force` ni una migración mayor del SDK.

Ver `VALIDATION.md` para los resultados finales y las alertas residuales.

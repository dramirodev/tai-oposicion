# Registro canónico de hallazgos de auditoría TAI

Fecha de corte: 5 de noviembre de 2026. Este registro enlaza los hallazgos UX con la auditoría del Agentic Test Explorer (ATE). `journey-audit-report.md` conserva contexto, mapas, capturas y análisis; `extreme-platform-status.md` conserva requisitos y estado de plataforma. Los IDs de este archivo son la referencia común: no se duplican hallazgos al actualizar los informes vinculados.

Estados válidos: `DETECTADO`, `ANALIZADO`, `PRIORIZADO`, `EN CORRECCIÓN`, `CORREGIDO SIN VERIFICAR`, `CORREGIDO Y VERIFICADO`, `BLOQUEADO`, `DESCARTADO, CON JUSTIFICACIÓN`.

## Hallazgos

### UX-001 — Navegación inconsistente entre escritorio y móvil

- **Categoría / funcionalidad:** Arquitectura de información / navegación principal.
- **Descripción:** Escritorio y el menú móvil agrupaban los destinos bajo categorías diferentes; Planificación aparecía en una categoría distinta a su modelo mental de estudio.
- **Evidencia:** Navegación inspeccionada en `WorkspaceNavigation.tsx` y composición del menú; informe UX y pruebas de navegación antes del cambio.
- **Severidad / prioridad:** P1 / alta.
- **Causa:** Dos composiciones de navegación mantenían categorías divergentes.
- **Solución propuesta:** Compartir las categorías Planificar, Practicar, Seguimiento y Entrenamientos sin cambiar rutas ni permisos.
- **Archivos afectados:** `src/app/layouts/WorkspaceNavigation.tsx`, `src/app/composition/navigation/study-menu-composition.ts`, `tests/study-menu-composition.test.js`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** `npm run check`; E2E focal de navegación, foco y teclado 4/4 Chromium/WebKit.
- **Resultado final:** Categorías coherentes y enlaces preservados. Evidencia adicional en [informe UX](journey-audit-report.md).

### UX-002 — Estado de sincronización podía ocultar un error de escritura

- **Categoría / funcionalidad:** Feedback y recuperación / sincronización Firebase.
- **Descripción:** Un estado de recepción correcta podía confundirse con confirmación de escritura aunque la escritura devolviera `permission-denied`.
- **Evidencia:** Observación manual documentada en `journey-audit-report.md`; pruebas de error y reintento allí referenciadas.
- **Severidad / prioridad:** P1 / alta por riesgo de confianza y pérdida aparente de progreso.
- **Causa:** El estado visible mezclaba resultado de recepción con resultado de escritura.
- **Solución propuesta:** Mantener estados separados y nunca presentar una escritura fallida como confirmada.
- **Archivos afectados:** `src/adapters/firebase/sync-status-store.ts`, `src/adapters/firebase/legacy-sync.ts` y tests relacionados.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Tests locales de error/reintento del informe; el Emulator sintético verifica denegaciones e aislamiento.
- **Resultado final:** La interfaz separa sincronización entrante de fallo de escritura; no implica certificación del backend productivo.

### UX-003 — Recarga de ruta protegida y logout podían perder contexto

- **Categoría / funcionalidad:** Cuenta / autenticación y recuperación.
- **Descripción:** Bajo una carrera de inicio de sesión, la recarga podía quedar esperando resolución de permisos; al cerrar sesión, el shell podía cancelar el destino Inicio.
- **Evidencia:** Reproducción determinista y regresiones Auth descritas en `journey-audit-report.md` y `explorer-mission-2026-11-04.md`.
- **Severidad / prioridad:** P1 / alta.
- **Causa:** La ruta protegida esperaba autorización antes de iniciar Auth y la transición del shell podía superseder logout.
- **Solución propuesta:** Resolver Auth antes de permiso y preservar el destino terminal de logout.
- **Archivos afectados:** `src/app/layouts/ReactScreen.tsx`, composiciones de acceso/layout y `tests/e2e/auth-emulator.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Auth/Firestore Emulator `demo-tai-auth`; journey de recarga/log-out y `npm run test:e2e:supertest` 7/7 Chromium.
- **Resultado final:** Ruta protegida y cierre de sesión se reproducen sin perder destino en Chromium. WebKit Auth no está certificado.

### UX-004 — Preguntas falladas resaltaba Inicio en la navegación móvil

- **Categoría / funcionalidad:** Navegación / orientación espacial.
- **Descripción:** En `/#/falladas`, Inicio aparecía como sección activa mientras el usuario consultaba Preguntas falladas.
- **Evidencia:** Capturas móvil clara/oscura; mapeo `falladas → home` en `useActiveSection`.
- **Severidad / prioridad:** P1 / alta para orientación.
- **Causa:** Mapeo heredado no seguía la agrupación actual de Seguimiento.
- **Solución propuesta:** Mapear Falladas a Progreso/Seguimiento.
- **Archivos afectados:** `src/app/layouts/useActiveSection.ts`, `tests/active-section.test.js`, `tests/e2e/routes.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Vitest y E2E Chromium/WebKit 2/2; aserción de `aria-current="page"`.
- **Resultado final:** Seguimiento queda activo y Inicio deja de anunciarse como selección actual.

### UX-005 — Propósito diario y actividad Active Recall no siempre coincidían con la agenda

- **Categoría / funcionalidad:** Planificación y sesión diaria / claridad de instrucciones.
- **Descripción:** El propósito podía sugerir tema nuevo sin actividad `newContent`; el primer paso de Active Recall podía no disponer de tarjetas para el tema.
- **Evidencia:** Casos de agenda y checkpoint identificados en tests de planificación y sesión.
- **Severidad / prioridad:** P2 / media.
- **Causa:** El propósito no se derivaba siempre de la agenda efectiva y el flujo asumía la presencia de tarjetas.
- **Solución propuesta:** Derivar propósito de actividades planificadas y usar preguntas como fallback de recuerdo cuando corresponda.
- **Archivos afectados:** `src/features/planning/*`, lógica de sesión/recall y pruebas de checkpoint.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Vitest de planificación y E2E de fallback de Active Recall descritos en `journey-audit-report.md`.
- **Resultado final:** No se altera la programación FSRS ni se infiere aprendizaje por completar actividades.

### UX-006 — Selector de actividad con una sola opción

- **Categoría / funcionalidad:** Planificación / formulario de programación de repaso.
- **Descripción:** El campo Actividad ofrecía únicamente “Test por tema”, imponiendo una selección sin decisión real.
- **Evidencia:** Journey del formulario reproducible en Chromium.
- **Severidad / prioridad:** P2 / media.
- **Causa:** Se reutilizaba un selector genérico para una modalidad fija.
- **Solución propuesta:** Presentar la actividad como información y conservar el valor de dominio `topicTest`.
- **Archivos afectados:** `src/features/planning/StudyCalendar.tsx`, `tests/e2e/routes.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO en Chromium; la prueba WebKit de duración sigue como hallazgo UX-007.
- **Pruebas:** Crear, confirmar, recargar y reprogramar en Chromium claro/oscuro 2/2.
- **Resultado final:** Se eliminaron pasos de selección sin cambiar persistencia ni reglas pedagógicas.

### UX-007 — Planificación invisible durante la interacción WebKit

- **Categoría / funcionalidad:** Responsive / compatibilidad WebKit y accesibilidad de controles.
- **Descripción:** El control de duración no puede seleccionarse en WebKit porque `main.planning-page` y descendientes calculan `visibility:hidden`.
- **Evidencia:** Reproducción WebKit aislada en los dos temas; el `main.planning-page` ya computa `visibility:hidden` inmediatamente después de entrar en `/#/planificacion`, antes de la interacción. `.route-transition`, `#app`, `body` y `html` computan `visible`. El `main` solo tiene clases de layout, no atributo `hidden`, clase `.invisible`, estilo inline ni ancestro `inert`; `body` no está en `is-initial-loading`. La inspección CSSOM de reglas `visibility` no encontró selector coincidente en la cadena de ancestros. El `selectOption` original termina en timeout de 30 s.
- **Severidad / prioridad:** P0 / bloqueante; ocultaba el flujo de planificación en un motor soportado.
- **Causa identificada:** `ReactScreen` y `FocusAfterLoad` notificaban que el contenido estaba listo durante la misma secuencia de montaje del árbol de ruta. WebKit podía calcular estilo heredado obsoleto cuando se insertaba el subárbol con controles nativos mientras se retiraba el gate inicial de visibilidad. La evidencia de mecanismo coincide con [WebKit Bugzilla 326092](https://bugs.webkit.org/show_bug.cgi?id=326092); el arreglo local mantiene el gate hasta después de dos ciclos `requestAnimationFrame` y no depende de una espera temporal de Playwright.
- **Comportamiento actual / propuesto / consecuencias:** Actual: WebKit dejaba `main.planning-page` oculto al abrir la ruta. Propuesto: mantener la pantalla de carga accesible/no interactiva hasta los primeros pases de estilo/layout y revelar la ruta preparada; conserva datos, navegación y reglas pedagógicas. Consecuencia: el primer contenido puede revelarse dos frames después de marcarse listo, evitando exponer una pantalla parcialmente calculada.
- **Solución aplicada:** `InitialAppLoadingProvider.markReady()` difiere el cambio de estado dos `requestAnimationFrame`, evita programaciones duplicadas y cancela callbacks al desmontarse. Se conserva el timeout de interacción original (30 s).
- **Archivos afectados:** `src/shared/ui/InitialAppLoading.tsx`, `tests/initial-app-loading.test.js`, `tests/e2e/css-ui.spec.ts` y capturas de regresión.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Regresión primer render **4/4** Chromium/WebKit × claro/oscuro; flujo de programar→confirmar→recargar→reprogramar **8/8** Chromium/WebKit × claro/oscuro; rutas completas `routes.spec.ts` **86/86**; evidencia visual nueva en `evidence/ux-audit-2026-11-04/` y trazas de fallo originales preservadas en `test-results/` cuando estaban disponibles.
- **Resultado final:** Planificación permanece visible y el control de duración puede usarse en Chromium y WebKit en ambos temas. El hallazgo queda cerrado con una regresión permanente. La suite global posterior pasó **260/260 ejecutados** (18 omitidos), incluidos los escenarios de Planificación en Chromium/WebKit.

### UX-008 — Diferencias visuales contra baseline histórico

- **Categoría / funcionalidad:** Consistencia visual / snapshots de rutas y temas.
- **Descripción:** La suite completa anterior conservó 64 diferencias de captura sobre el baseline histórico. Una revalidación focal actual del inventario de rutas registró 20 diferencias en cinco rutas, cada una repetida en tema claro/oscuro y Chromium/WebKit.
- **Evidencia:** Runner integral previo: baseline **70/70**; candidata **188 aprobadas/66 fallidas/16 omitidas**; 66 IDs coinciden con 66 contextos: 64 capturas (16 rutas × tema claro/oscuro × Chromium/WebKit) y 2 timeouts WebKit UX-007. Se inspeccionaron visualmente los 16 estados actuales y sus overlays de comparación, y se contrastaron con cambios de componentes frente a `baseline-ref.txt` (`c81acbc…`). Causas/rutas: Accesos, Errores, Simulacros, Lectura, Quiz, Resultado, Estadísticas, Temas vistos y Test reflejan cambios de estructura/copy/acciones en páginas actuales; Inicio y Ajustes reflejan contenido vigente; Falladas refleja UX-004; Relámpago/Trampas reflejan UX-010. Los diffs legibles iniciales se conservaron en `evidence/ux-audit-2026-11-04/`; todas las capturas actuales del inventario están versionadas en `snapshots/{chromium,webkit}-darwin/`.
- **Severidad / prioridad:** P2 / media; no todas las diferencias son defectos, algunas pueden ser cambios intencionales.
- **Causa:** El baseline antecede a cambios de producto/navegación en las cinco rutas; hay que comprobar el resto de discrepancias de la suite total.
- **Solución propuesta:** Mantener las 20 referencias candidatas actualizadas para las cinco rutas que estaban desalineadas; las otras 44 capturas candidatas ya correspondían a la interfaz actual. No alterar el baseline histórico mientras los cambios actuales no formen parte de un commit de referencia.
- **Archivos afectados:** `tests/e2e/snapshots/{chromium,webkit}-darwin/{home,settings,falladas,relampago,trampas}-{light,dark}.png`; fuentes de las cinco rutas referenciadas en UX-004/UX-010 y cambios previos de Inicio/Ajustes.
- **Estado de implementación:** DESCARTADO, CON JUSTIFICACIÓN.
- **Pruebas:** Revalidación de snapshots candidatas: `routes.spec.ts` **86/86** aprobadas en Chromium/WebKit, claro/oscuro y journeys de ruta. Se actualizaron solo 20 referencias (5 rutas × 2 temas × 2 motores) y se verificaron **20/20** sin `--update-snapshots`. La suite completa continúa reportando diferencias porque compara contra el commit histórico `c81acbc…`, no contra los snapshots candidatos.
- **Resultado final:** Las 64 diferencias son drift visual respecto a una referencia anterior, no fallos de las capturas de la rama: todos los estados de ruta pasan frente a sus capturas candidatas actuales. Se conserva el historial y las 20 actualizaciones selectivas. El baseline integral seguirá mostrando esas diferencias hasta avanzar su referencia en un commit revisado. Los timeouts WebKit que se habían atribuido a UX-007 quedaron resueltos por la corrección registrada en ese hallazgo.

### UX-009 — Revisión manual WCAG 2.2 AA incompleta

- **Categoría / funcionalidad:** Accesibilidad / aplicación completa.
- **Descripción:** Pruebas automatizadas y algunas comprobaciones manuales cubren teclado, foco, reflow y estados, pero no lector de pantalla, contraste de todos los estados, zoom 400% ni todos los criterios.
- **Evidencia:** Cobertura y límites expresos en “Heurísticas, carga cognitiva y accesibilidad” de `journey-audit-report.md`.
- **Severidad / prioridad:** P1 / alta como brecha de cobertura; no es una declaración de incumplimiento de criterios no inspeccionados.
- **Causa:** Falta una pasada manual sistemática por páginas, diálogos, tablas y gráficos.
- **Solución propuesta:** Ejecutar matriz WCAG con teclado, zoom, lector de pantalla y revisión manual de contraste; convertir barreras concretas en hallazgos individuales.
- **Archivos afectados:** Informe de auditoría y los componentes que evidencie la evaluación.
- **Estado de implementación:** ANALIZADO.
- **Pruebas/evidencia:** Auditoría de árbol accesible autenticada con owner sintético Emulator en 16 rutas a 1280×900 y Home/Planificación a 375×812: **312 controles** encontrados, todos con nombre accesible; se guardaron JSON y capturas de Planificación escritorio/móvil y menú en `evidence/accessibility-2026-11-05/`. Pruebas de teclado mediante Playwright: navegación por enlace y foco en encabezado destino; menú modal cierra con Escape y restaura foco; suite móvil, foco, gráficos y estados vacíos Chromium/WebKit **30/30**. `routes.spec.ts` pasa **86/86** en Chromium/WebKit: 18 destinos, temas claro/oscuro y medición de overflow a 320/640 CSS px en cada caso. Capturas de Planificación a ambos anchos en ambos motores. Esa medición de viewport no simula el zoom nativo. La suite global posterior pasó **260/260 ejecutados** (18 omitidos) en Chromium/WebKit. Verifica nombres/roles/boxes ARIA y los flujos automatizados, no operación de un lector de pantalla.
- **Pendiente comprobable:** no se ha realizado prueba con lector de pantalla real, zoom de navegador a 200%/400%, contraste manual exhaustivo de todos los estados ni evaluación WCAG criterio por criterio de todos los formularios/errores/cargas. Los límites de objetivos del menú y el tamaño visual de controles pequeños requieren revisión específica con contexto de diseño; no se infiere incumplimiento solo del tamaño del nodo input.
- **Resultado final:** No se declara conformidad WCAG 2.2 AA. La brecha se reduce con evidencia automatizada y de teclado en rutas críticas; la validación asistiva/zoom/contraste integral sigue abierta.

### UX-010 — Iconos de título se muestran como bloque en móvil

- **Categoría / funcionalidad:** Responsive / jerarquía de títulos en Pregunta relámpago y Detective de trampas.
- **Descripción:** El SVG con clase `inline-feature-icon` se representa en una línea propia encima del texto del título en la captura móvil de WebKit, aunque la clase indica comportamiento en línea; esto consume altura y desplaza el enunciado/opciones.
- **Evidencia:** `evidence/ux-audit-2026-11-04/webkit-relampago-light-actual.png` muestra el icono encima de “Pregunta relámpago”; la referencia `webkit-relampago-light-expected.png` lo presenta junto al texto. La utilidad compartida aplica márgenes y alineación vertical, pero no declara `display`; Tailwind Preflight fija SVG como `display:block`.
- **Severidad / prioridad:** P2 / media; pérdida de espacio útil y título visualmente fragmentado en viewport móvil.
- **Causa:** La utilidad `inline-feature-icon` no revierte el `display:block` global de SVG.
- **Comportamiento actual / propuesto / consecuencias:** Actual: icono ocupa una línea propia. Propuesto: SVG `inline-block` y alineado con el texto; conserva icono, contenido y semántica, y recupera altura para contenido de la pregunta. Riesgo: alineación visual de otros usos de la misma utilidad.
- **Solución propuesta:** Añadir `display:inline-block` a la utilidad compartida y cubrir ambos módulos con E2E responsive.
- **Archivos afectados:** `src/shared/styles/index.css`, `tests/e2e/css-ui.spec.ts`; consumidores `src/features/trainers/LightningPage.tsx` y `TrapsPage.tsx`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas de verificación:** `npm run check` (958 aprobadas/27 omitidas); regresión E2E focal Chromium 1/1 y WebKit 1/1 en viewport 393×852, comprobando `display:inline-block` y línea compartida para el título de Relámpago y ambos consumidores.
- **Resultado final:** Los iconos se muestran en línea junto al título en Chromium y WebKit; se conserva el contenido y la semántica.

### UX-011 — El menú no devolvía el foco al disparador en WebKit tras abrir con puntero

- **Categoría / funcionalidad:** Accesibilidad / navegación por diálogo / WebKit.
- **Descripción:** Si el menú se abre con clic y se cierra con Escape, WebKit puede no enfocar el botón que originó el clic. `dialog-actions` guarda `document.activeElement` como retorno; Safari puede dejar el foco en `body` tras activación por puntero y el cierre pierde el contexto.
- **Evidencia:** Reproducción adversarial en Playwright, menú de Inicio: Chromium pasó el ciclo, WebKit falló `toBeFocused()` inmediatamente tras Escape. Traza y `error-context.md` se generaron bajo `test-results/extreme-profile-EXTREME-de-f1f9a-ernadas-sobre-el-menú-móvil-webkit-darwin/` en la ejecución previa; regresión repetida después del arreglo.
- **Severidad / prioridad:** P1 / alta para control del foco en diálogo móvil.
- **Causa:** La implementación dependía del foco implícito del navegador después de un clic; WebKit no garantiza ese foco de puntero.
- **Comportamiento actual / propuesto / consecuencias:** Actual: la apertura con clic puede dejar `body` como foco previo del diálogo. Propuesto: enfocar el botón activador explícitamente antes de abrir; el foco inicial del diálogo sigue yendo al título, y Escape devuelve al botón. No cambia destinos, permisos ni persistencia.
- **Solución aplicada:** Los activadores de menú de Inicio y de la navegación móvil enfocan `currentTarget` al comenzar el clic.
- **Archivos afectados:** `src/features/home/HomeView.tsx`, `src/app/layouts/WorkspaceNavigation.tsx`, `tests/e2e/extreme-profile.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** La prueba de **1.000 acciones** alternadas (500 aperturas por puntero + 500 cierres Escape con foco restaurado) pasó en Chromium y WebKit; focal combinada con el flujo diario **4/4**.
- **Resultado final:** Escape cierra el menú y devuelve el foco al disparador en ambos motores; el caso queda en el perfil EXTREME y la regresión global.

### UX-012 — El contador de preguntas falladas usa plural con un único resultado

- **Categoría / funcionalidad:** Microcopy y mensajes de estado / Falladas.
- **Descripción:** Con exactamente una pregunta fallada, el contador anunciado por `aria-live="polite"` decía «1 preguntas».
- **Evidencia:** La nueva prueba `failures-empty-state-journey.spec.ts`, con fixture local `TAI2024B-P1-05`, reprodujo el texto en Chromium y WebKit tanto en 320 como en 1440 px. El filtro de búsqueda sí redujo correctamente la lista a un resultado.
- **Severidad / prioridad:** P2 / media-baja; no bloquea la tarea, pero reduce la claridad del feedback anunciado y visible.
- **Causa identificada:** La rama de singular/plural solo distinguía lista filtrada de lista completa y siempre concatenaba «preguntas».
- **Comportamiento actual / propuesto / consecuencias:** Actual: «1 preguntas». Propuesto: «1 pregunta» cuando el total mostrado es uno; el formato «n de total preguntas» permanece en las listas filtradas. Solo cambia el texto, sin afectar selección o negocio.
- **Solución propuesta:** Aplicar singular cuando `scopedQuestions.length === 1` en el contador sin filtro adicional.
- **Archivos afectados:** `src/features/failures/FailuresPage.tsx`, `tests/e2e/failures-empty-state-journey.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Solución aplicada:** El contador ahora muestra «1 pregunta» para una sola pregunta y conserva «n preguntas» en plural; el mensaje filtrado «n de total preguntas» no se altera.
- **Pruebas:** `npm run test:e2e -- tests/e2e/failures-empty-state-journey.spec.ts` **8/8** Chromium/WebKit, 320/1440 px; incluye `aria-live` singular, búsqueda, estados vacío/no-vacío, tema, temario, racha, estado de acción, guardado/reload de la marca y práctica. En el caso poblado se comprueba además que no hay desbordamiento horizontal a 320 px y que el objetivo completo de la marca mide al menos 24×24 CSS px. `npx vitest run tests/failures-page.test.js`: **2/2** tras añadir fallo temporal, acción Reintentar y carga recuperada. Fixture E2E no se resemilla en reload. `npm run check`: **960 aprobadas/27 omitidas** (189 archivos aprobados/1 omitido). Prettier pasa para el spec Playwright; `git diff --check` limpio.
- **Resultado final:** El estado visible/anunciado es gramaticalmente correcto. La marca queda en storage y vuelve marcada tras recargar; capturas de estados populated/restored revisadas visualmente.

### UX-013 — El estado vacío de Simulacros no orientaba sobre el filtro de origen

- **Categoría / funcionalidad:** Microcopy y recuperación / Simulacros por examen.
- **Descripción:** Al combinar Origen «Academia» y Turno «Ingreso libre», la lista queda vacía, pero el mensaje solo aconsejaba cambiar año o turno y omitía el origen.
- **Evidencia:** Reproducido en `bridge.spec.ts`: los filtros combinados dejan cero filas y desactivan Estudiar/Examen; el copy anterior no ofrecía cambiar el origen que también interviene en la selección.
- **Severidad / prioridad:** P2 / media; provoca ensayo de filtros que no corresponden a todas las causas posibles.
- **Causa identificada:** El texto del estado vacío nombraba solo dos de los tres filtros interactivos.
- **Comportamiento actual / propuesto / consecuencias:** Actual: «No hay exámenes con estos filtros. Prueba con otro año o turno». Propuesto: «No hay exámenes con estos filtros. Cambia alguno de los filtros para ver otros exámenes». Solo modifica orientación de recuperación; filtros, catálogo y reglas de selección permanecen iguales.
- **Archivos afectados:** `src/features/simulation/SimulationPage.tsx`, `tests/e2e/bridge.spec.ts` y documentación de auditoría.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas de verificación:** `npm run test:e2e -- tests/e2e/bridge.spec.ts --grep 'Simulacros por examen permite filtrar'` pasó **2/2** Chromium/WebKit. Verifica filtros oficiales/turno/año, selección activa, acciones habilitadas, combinación sin resultados, mensaje recuperable y acciones deshabilitadas; restablecer turno y año devuelve resultados. La suite completa `bridge.spec.ts` pasó **50/50**. Evidencia móvil en `evidence/accessibility-2026-11-05/simulation-exam-{filtered,empty}-320px-{chromium,webkit}.png`.
- **Resultado final:** El estado vacío propone cambiar cualquiera de los filtros disponibles y la lista se recupera al ajustar filtros válidos. Sin cambios a selección ni reglas del catálogo.

### UX-014 — Cancelar el borrado de progreso no devolvía el foco al activador en WebKit

- **Categoría / funcionalidad:** Accesibilidad, recuperación y control del usuario / Ajustes → Zona delicada.
- **Descripción:** Al abrir «Borrar progreso de este dispositivo» con clic y cancelar con Escape, el diálogo desaparecía en WebKit pero el foco no volvía al botón que lo abrió. Chromium sí restauraba el foco.
- **Evidencia:** Reproducción Playwright anterior a la corrección en WebKit a 320 y 1440 px: el diálogo se oculta y el botón queda inactivo tras Escape. Después del arreglo, `settings-preferences-journey.spec.ts` pasó 4/4 en Chromium/WebKit en ambos anchos; valida cancelación, retorno de foco y preferencias locales sin ejecutar `resetAll`.
- **Severidad / prioridad:** P1 / alta; el usuario de teclado pierde el punto de retorno tras cancelar una acción destructiva.
- **Causa probable:** El diálogo compartido solo recibía el `document.activeElement` al solicitar confirmación. WebKit no conserva el botón invocador como elemento activo tras la activación de puntero, y la restauración genérica no dispone del activador correcto.
- **Comportamiento actual / propuesto / consecuencias:** Antes: al cancelar se cierra el diálogo, pero WebKit puede dejar foco en `body`. Después: `ResetSection` conserva el botón que abrió el diálogo y le devuelve el foco cuando termina la promesa. El borrado sigue condicionado a confirmación; el test solo cancela.
- **Archivos afectados:** `src/features/settings/SettingsPage.tsx`, `tests/e2e/settings-preferences-journey.spec.ts`, informes UX y checklist de accesibilidad.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas de verificación:** `npm run test:e2e -- tests/e2e/settings-preferences-journey.spec.ts` **4/4** Chromium/WebKit, 320/1440 px; Enter/Espacio en preferencias, Escape en confirmación, foco restaurado, datos locales preservados y cero borrados.
- **Resultado final:** Cancelar el diálogo vuelve al control que lo abrió en ambos motores. No se verificó la confirmación destructiva porque no es necesaria para esta corrección.

### UX-015 — Campos de nombre y nota del evento comprimidos en Ajustes

- **Categoría / funcionalidad:** Formularios / Ajustes → Entrenamiento semanal → Eventos y excepciones.
- **Descripción:** «Nombre» y «Procedencia o nota» se renderizaban como campos de texto de 20×20 CSS px y la escritura quedaba visualmente comprimida. La etiqueta y el área clicable eran mayores, pero no el campo de entrada.
- **Evidencia:** Inspección headless Chromium con perfil sintético: `getBoundingClientRect()` y estilos calculados devolvieron 20×20 px; el selector `.training-activities & input` aplicaba tamaño de checkbox a todos los inputs y la regla flex de `& label` desplazaba el layout de cuadrícula de las etiquetas. La regresión Playwright falló primero por la altura y luego por el ancho de «Procedencia» en viewport de 320 px.
- **Severidad / prioridad:** P1 / alta para completar una tarea de configuración en móvil y escritorio.
- **Causa:** Reglas del fieldset compartido con los controles de actividad se aplicaban a los campos de texto y labels del calendario.
- **Solución:** Limitar el layout flex y el tamaño de 20 px a labels con checkbox; añadir `training-event-fields` para campos de evento de ancho completo, con min-height de control y estilos de entrada coherentes.
- **Archivos afectados:** `src/shared/styles/index.css`, `src/features/settings/SettingsPage.tsx`, `tests/e2e/settings-training-schedule-journey.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas de verificación:** La regresión comprueba ancho ≥100 px y alto ≥40 px en ambos campos y target ≥24×24 px para etiqueta checkbox; suite focal **4/4** Chromium/WebKit a 320/1440 px. Verificación más reciente: `npm run check` **960/27** y E2E global `npm run test:e2e` **294/322**, 28 omitidas por Emulator/EXTREME y cero fallos en Chromium/WebKit (11,0 min). Se recorren validación, persistencia y eliminación del evento.
- **Resultado final:** Los campos recuperan dimensiones de edición legibles; los checkboxes de actividades conservan su presentación compacta.

### ATE-001 — Aserción inmediata podía observar el heading anterior a la ruta nueva

- **Categoría / funcionalidad:** Infraestructura E2E / sincronización de navegación SPA.
- **Descripción:** Tras cambiar hash, el URL ya mostraba Temario mientras React aún renderizaba el heading de Planificación; `assert_text` inmediato producía una falsa alarma sobre TAI.
- **Evidencia:** `run-fVINn8` falló en el paso 4; `run-cLq3rk`, `run-gtUqXm` y `run-CSDBL0` pasan tras esperar el heading destino.
- **Severidad / prioridad:** P1 / alta para validez del test, no defecto de producto confirmado.
- **Causa:** El plan no esperaba la transición del render antes de comparar contenido.
- **Solución propuesta:** Esperar un selector semántico del destino antes de comprobar heading/salud.
- **Archivos afectados:** `tests/e2e/missions/tai-profile-stress.yaml`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** QUICK 2/2, INTENSIVE 4/4, EXTREME 6/6 en Emulator.
- **Resultado final:** Se clasifica como defecto de sincronización de la misión, no como error persistente de navegación TAI.

### ATE-002 — Acciones de historial/recarga exigían selector inexistente

- **Categoría / funcionalidad:** Agentic Test Explorer / ejecución de journeys de recuperación.
- **Descripción:** El runner carecía de acciones dedicadas atrás/adelante/recarga; al añadirse, el validador exigió un selector y las rechazó antes de ejecutar.
- **Evidencia:** `test_history_and_reload_recovery_are_deterministic` falló con “step 2 requires selector”; tras corregirlo el test pasa.
- **Severidad / prioridad:** P1 / alta para cubrir recuperación solicitada.
- **Causa:** El conjunto de acciones sin selector no incluía los controles de historial.
- **Solución propuesta:** Agregar `go_back`, `go_forward`, `reload` al dispatcher y validador.
- **Archivos afectados:** ATE `src/agentic_explorer/tools/browser/engine.py`, `scenario_batch.py`, `tests/test_scenario_runner.py`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Test focal 1/1 y suite ATE 141 aprobadas/5 omitidas.
- **Resultado final:** El replay local comprueba back/forward/reload y registra cada acción en Action Tape.

### ATE-003 — Presupuesto económico concurrente podía sobre-reservarse

- **Categoría / funcionalidad:** ATE / protección de cuota Gemini.
- **Descripción:** Dos llamadas pendientes podían comparar solo coste ya facturado más su propia estimación y reservar más que el cap en conjunto.
- **Evidencia:** Regresión mock `test_pending_cost_reservation_blocks_concurrent_budget_overshoot` en `tests/test_usage_budget.py`.
- **Severidad / prioridad:** P1 / alta por riesgo de gasto.
- **Causa:** No se sumaban reservas estimadas de otras llamadas pendientes.
- **Solución propuesta:** Incluir el coste reservado de `_pending` al aplicar cap diario y por ejecución.
- **Archivos afectados:** ATE `src/agentic_explorer/utils/usage_budget.py`, `tests/test_usage_budget.py`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Suite de presupuesto 14/14; suite ATE 141/5.
- **Resultado final:** Reservas estimadas concurrentes quedan limitadas dentro de un mismo gestor. El límite aún puede excederse si el coste de salida real supera su estimación y no hay coordinación interproceso.

### ATE-004 — Timeouts del proveedor no se reconocían como transitorios

- **Categoría / funcionalidad:** ATE / resiliencia de Gemini.
- **Descripción:** `TimeoutError`/deadline no entraba en la clasificación de errores reintentables.
- **Evidencia:** Test mock añadido para `TimeoutError`, deadline, 429/503 y cuota diaria terminal.
- **Severidad / prioridad:** P1 / alta para recuperación de llamadas temporales.
- **Causa:** La lista de errores transitorios incluía 429/503, pero no timeouts.
- **Solución propuesta:** Clasificar TimeoutError y formas textuales comunes, conservando reintentos limitados y backoff.
- **Archivos afectados:** ATE `src/agentic_explorer/utils/retry.py`, `tests/test_usage_budget.py`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Test focal presupuesto 14/14; ATE 141 aprobadas/5 omitidas; no hubo llamada a proveedor.
- **Resultado final:** Timeouts temporales se pueden reintentar; cuota diaria continúa como terminal.

### ATE-005 — Cobertura total de controles y journeys funcionales extremos pendiente

- **Categoría / funcionalidad:** Cobertura E2E / producto TAI completo.
- **Descripción:** Los perfiles actuales prueban owner, navegación, heading, historial y repetición; no recorren de forma extrema todo botón/formulario/estado ni validan todas las relaciones de persistencia entre estudio, test, Active Recall, estadísticas y recuperación.
- **Evidencia:** Misión route smoke 48 pasos/16 módulos y perfiles stress documentados en `extreme-platform-status.md`; la inspección de cada control no está asociada aún a resultado y oráculo.
- **Severidad / prioridad:** P1 / alta como brecha de cobertura.
- **Causa:** Falta inventario de controles por rol/estado y fixtures longitudinales reusables.
- **Solución propuesta:** Construir matriz control→perfil→estado→acción→resultado y journeys de dominio con Emulator, oráculos de integridad y variantes de interrupción.
- **Archivos afectados:** `tests/e2e/missions/`, fixtures synthetic users, `scripts/e2e/`, informes.
- **Estado de implementación:** EN CORRECCIÓN.
- **Pruebas:** `npm run test:e2e:supertest` **12/12** Chromium con Auth/Firestore Emulator; inventario autenticado de **16 rutas escritorio + 2 estados móviles**, 312 controles nombrados y cero controles sin nombre en el árbol ARIA inicial. Se verifica estudio→autoevaluación→resultado persistido, recuperación owner tras pagehide/reload con pregunta/respuesta y sesión preservadas, Lectura atenta (3 pasos, barrera temporal, respuesta, avance y salida confirmada), Curación (opciones, filtro vacío, selección estable, formulario sintético, guardado en localStorage y recuperación tras recarga), permisos de cinco perfiles y aislamiento de reglas. `npm run test:e2e -- tests/e2e/stats-charts.spec.ts` pasó **8/8** Chromium/WebKit (claro/oscuro, 320/1440 px). `routes.spec.ts` pasó **86/86**; `bridge.spec.ts` **50/50** Chromium/WebKit. Los journeys de preferencias, agenda/eventos y copias de seguridad de Ajustes pasaron **12/12**; los journeys de borrado confirmado y fecha objetivo intermodular añaden **8/8** Chromium/WebKit a 320/1440 px. La regresión global más reciente pasó **294/322**; omitió 28 (Emulator/EXTREME) y no tuvo fallos en 11,0 min. `npm run check` pasó **960/27**; `npm run test:e2e:extreme` pasó **2/2**, 1.000 acciones por motor. Capturas e inventario descritos en este registro; el fixture “aprobado” no demuestra cotejo humano ni exactitud curricular.
- **Calidad de evidencia visual:** en la repetición de `supertest-emulator.spec.ts` se confirmó que marcar el tema como visto devuelve a Planificación para la autoevaluación. Se separaron los hitos: `owner-temario-estudio.png` se captura con H1 Temas vistos visible antes de marcar el tema; `owner-planificacion-autoevaluacion.png` se captura después de comprobar la ruta de retorno y la autoevaluación. E2E Emulator posterior **12/12** y ambas capturas inspeccionadas.
- **Recorrido cross-module adicional:** `npm run test:e2e -- tests/e2e/stats-practice-journey.spec.ts` pasó **4/4** en Chromium/WebKit a 320/1440 px: Progreso → practicar T1.02 → responder las 15 preguntas → Resultado → Progreso. Comprueba respuestas, 15 revisiones, un intento y los 15 registros de respuesta; el resumen de Progreso persiste tras recargar. También desplaza la última opción y verifica que queda antes de la barra fija. Capturas en `evidence/accessibility-2026-11-05/stats-to-topic-test-{initial,readable-option,result}-{320px,1440px}.png`; sin Firebase ni datos remotos. La persistencia comprobada es local y no acredita sync.
- **Ajustes: exportación de análisis para IA:** `settings-backup-journey.spec.ts` prueba rango de fecha invertido, filtro de modalidad sin resultados, validación sin modalidad, selección/deselección, botón bloqueado con cero seleccionadas, resumen/preview y descarga de ZIP tras seleccionar una sesión completada. El mismo test detectó y cerró UX-016 (copy singular) y UX-017 (prevención); pasó **4/4** Chromium/WebKit a 320/1440 px. El ZIP se genera localmente y solo se descarga tras acción explícita; no se transmite.
- **Ajustes: uso sin conexión:** `settings-page.test.js` simula una descarga pendiente, anuncia progreso `1/4`, cancela al cambiar de cuenta, comprueba feedback ante fallo, recupera el botón y permite reintentar con éxito (**11/11** en el archivo). `routes.spec.ts --grep 'shell de Vite, CSP y arranque sin conexión'` pasó **2/2** Chromium/WebKit: descarga real al CacheStorage, valida «disponibles sin conexión», recarga Inicio sin red y comprueba acceso local a explicaciones y fuentes, más shell y fuente Geist.
- **Ajustes y preferencias:** `npm run test:e2e -- tests/e2e/settings-preferences-journey.spec.ts` pasó **4/4** Chromium/WebKit, 320/1440 px. Desde la interfaz cambia Tema a Oscuro y Tamaño de letra a A+++ mediante clic, Enter y Espacio; valida `aria-pressed`, los atributos efectivos, la persistencia en `cfg.ui`, ausencia de overflow y la restauración después de reload. Evidencia: `evidence/accessibility-2026-11-05/settings-preferences-{320,1440}px-{chromium,webkit}.png`. El setup solo siembra al primer documento para no sobrescribir lo que se verifica al recargar.
- **Ajustes y planificación semanal:** `npm run test:e2e -- tests/e2e/settings-training-schedule-journey.spec.ts` pasó **4/4** Chromium/WebKit a 320/1440 px. Cambia minutos del lunes, enfoque del martes y duración del bloque; valida rechazo visible de fecha final anterior, crea un evento sintético, recarga, comprueba preferencias/evento persistidos y lo elimina. Capturas en `evidence/accessibility-2026-11-05/settings-training-{320,1440}px-{chromium,webkit}.png`. Fixture local invitado/propietario sintético; sin Firebase ni producción.
- **Ajustes y borrado de progreso:** `settings-reset-journey.spec.ts` confirma con fixture exclusivamente local que la acción destructiva se ejecuta solo tras aceptación, que el diálogo mantiene el foco entre botones con Tab, devuelve el foco al activador, anuncia el resultado y conserva un estado vacío tras reload. **4/4** Chromium/WebKit a 320/1440 px; evidencias `evidence/accessibility-2026-11-05/settings-reset-{320,1440}px-{chromium,webkit}.png`. No usa Auth ni Firebase Emulator porque el usuario probado es invitado y ningún dato remoto se altera.
- **Fecha objetivo entre módulos:** `settings-exam-target-journey.spec.ts` configura una fecha personal desde el enlace de Inicio, fuerza reload completo, verifica que el valor se conserva, muestra la cuenta atrás y el objetivo con fecha legible en Planificación, y vuelve a Ajustes mediante el enlace de la propia planificación. **4/4** Chromium/WebKit a 320/1440 px; capturas `evidence/accessibility-2026-11-05/settings-exam-target-{planning-,}{320,1440}px-{chromium,webkit}.png`. La semilla sólo usa `tai.v1:guest`; no conecta a Firebase.
- **Copias y análisis para IA en Ajustes:** `settings-backup-journey.spec.ts` pasó **4/4** Chromium/WebKit a 320/1440 px. Exporta JSON con estadística sintética; valida JSON ilegible, cancelación y confirmación; importa una sesión interrumpida y otra completada, dos intentos y cuatro eventos sintéticos; coteja el round-trip y ausencia de duplicados. En el componente de análisis verifica filtro vacío, error sin modalidad, sesión completada, copy singular, habilitación según selección, preview y descarga ZIP. Conserva progreso y preferencias tras reload. Capturas `evidence/accessibility-2026-11-05/settings-backup-{320,1440}px-{chromium,webkit}.png`; fixture sin Firebase.
- **Falladas vacío, poblado y recuperación:** Playwright **8/8** Chromium/WebKit a 320/1440 px prueba búsqueda, no coincidencia, filtros por tema/temario/racha, estado habilitado/deshabilitado, marca tras reload y práctica del enunciado correcto; valida reflow horizontal a 320 px y el objetivo de marca ≥24×24 CSS px. Un test de componente verifica fallo de carga, mensaje `alert`, reintento y recuperación: **2/2** en `failures-page.test.js`. Las capturas pobladas/revisadas están en `evidence/accessibility-2026-11-05/failures-{populated,reviewed-restored}-{320px,1440px}.png`. La simulación de error es un test de componente, no se afirma que Playwright haya inyectado una caída de red.
- **Brecha restante:** el inventario cubre controles visibles en estados iniciales y algunos estados dinámicos concretos, pero aún no acciona/verifica cada control, todos los formularios inválidos, diálogos, historial extenso y nuevo usuario en cada módulo, import/export/eliminación del borrador curatorial, sincronización entre usuarios/pestañas ni cada vínculo entre módulos. Se cierra la brecha específica del round-trip de historial de intentos en la copia local; no se afirma cobertura exhaustiva. Continuar matriz control→acción→resultado y journeys longitudinales/adversariales.
- **Resultado final:** Cobertura ampliada y reproducible, hallazgo todavía abierto hasta cerrar estados dinámicos, continuidad entre módulos y oráculos de dominio en los controles identificados. La suite completa `bridge.spec.ts` pasó **48/48** en Chromium/WebKit tras añadir el caso de configuración; la configuración por sí sola pasó **2/2**.

### ATE-006 — Perfiles CI integrados localmente; ejecución remota pendiente

- **Categoría / funcionalidad:** Automatización / CI.
- **Descripción:** QUICK/INTENSIVE/EXTREME tienen workflows y comandos locales configurados, pero la ejecución de GitHub Actions aún no está demostrada.
- **Evidencia:** Revisión de workflows existentes, registrada en `extreme-platform-status.md`.
- **Severidad / prioridad:** P2 / media.
- **Causa:** `e2e-profiles.yml` se encuentra solo en esta rama; GitHub no permite despacharlo mientras no exista en la rama por defecto. La rama está publicada, pero no tiene PR ni ejecución remota asociada.
- **Solución propuesta:** QUICK en PR sin Gemini; INTENSIVE programado; EXTREME solo bajo demanda con Emulator y budgets explícitos.
- **Archivos afectados:** `.github/workflows/` y documentación de ejecución.
- **Estado de implementación:** CORREGIDO SIN VERIFICAR.
- **Solución implementada:** `ci.yml` ejecuta QUICK autenticado en Emulator en PR y carga resultados como artefacto. `e2e-profiles.yml` añade INTENSIVE programado/manual y EXTREME manual; los perfiles usan solo pruebas Playwright deterministas, sin Gemini. EXTREME ejecuta la suite de navegador más un escenario acotado de 1.000 acciones con aserciones de estado/foco.
- **Pruebas:** YAML de ambos workflows validado con parser local; Prettier pasa para workflows, package/config y pruebas. `npm run test:e2e:extreme` local **2/2** Chromium/WebKit (1.000 acciones cada uno; 50,4 s); suite global **260 pasadas/18 omitidas/0 fallidas**. Tras publicar `ac71bea`, `gh run list --branch audit/ux-integral-2026-11-04` no mostró ejecuciones. `gh workflow list` no presenta `e2e-profiles.yml`; `gh workflow run ...` devolvió HTTP 404: workflow no encontrado en la rama por defecto. No se declara CI remoto verificado.
- **Resultado final:** Integración local y perfiles deterministas verificados. Estado remoto requiere que el workflow se integre primero en la rama por defecto (por ejemplo, mediante PR y posterior integración) y una ejecución real. La misión ATE con framework externo no invoca Gemini desde CI.

### ATE-007 — Matriz de rechazo del guard Emulator no estaba cubierta

- **Categoría / funcionalidad:** Aislamiento Firebase / preflight fail-closed.
- **Descripción:** La regresión cubría una configuración Emulator válida y una URL externa, pero no verificaba por separado flags ausentes, proyecto productivo ni endpoints Auth/Firestore no emulados.
- **Evidencia:** Test inicial `test_tai_emulator_guard_requires_demo_project_and_loopback_endpoints` tenía dos ramas; se amplió con subtests por cada variable insegura.
- **Severidad / prioridad:** P1 / alta por riesgo de escrituras fuera del Emulator.
- **Causa:** Matriz negativa incompleta en el test del guard, no fallo confirmado de configuración válida.
- **Solución propuesta:** Mantener casos negativos individualizados y exigir rechazo antes de abrir el navegador.
- **Archivos afectados:** ATE `tests/test_scenario_batch.py`; integración TAI `scripts/e2e/agentic-explorer-guard.py`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Test focal de guard 1/1; suite ATE 141 aprobadas/5 omitidas; los perfiles TAI ejecutados confirman `demo-tai-auth`, guard de red activo y cero destinos bloqueados.
- **Resultado final:** Configuraciones faltantes o externas se rechazan; no se accedió a Firebase de producción.

### ATE-008 — El E2E diario esperaba un test que su fixture no configuraba

- **Categoría / funcionalidad:** Calidad E2E / Planificación diaria.
- **Descripción:** El test `Planificación prepara la sesión fuera de Inicio...` asumía que comenzar llevaba a `topicTest`, pero el fixture solo fija T1.02 como tema nuevo y no configura actividad alternativa. La primera actividad correcta del plan es `newContent`, que navega a Temario.
- **Evidencia:** En la suite E2E completa, Chromium y WebKit recibieron `#/temario?topic=T1.02&dailyTraining=newContent&trainingSessionId=...&trainingActivityId=...`; la pantalla y acción coincidían con el plan mostrado. Los demás tests de agenda y Active Recall pasaron.
- **Severidad / prioridad:** P2 / media; producía dos fallos falsos y hacía menos fiable la regresión del journey.
- **Causa:** Expectativa antigua codificada en la prueba, incompatible con el estado de agenda/sesión que el fixture genera actualmente.
- **Solución aplicada:** Cambiar solo el oráculo E2E para comprobar la ruta de `newContent`, el tema T1.02 y el título de Temario; no se cambió la generación del plan ni sus reglas pedagógicas.
- **Archivos afectados:** `tests/e2e/css-ui.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** Prueba aislada del flujo pasó en Chromium y WebKit; repetición focal combinada con stress EXTREME **4/4**.
- **Resultado final:** El test valida el primer paso que su fixture establece y ya no clasifica el comportamiento válido como fallo.

### UX-016 — Mensaje de sesiones disponibles usa plural para un resultado

- **Categoría / funcionalidad:** Microcopy / exportación de análisis para IA en Ajustes.
- **Descripción:** Cuando el filtro devuelve una sesión, el estado visible/anunciado mostraba «1 sesión completada disponibles».
- **Evidencia:** La regresión de `settings-backup-journey.spec.ts` importó una sesión completada sintética y reprodujo el mensaje en Chromium y WebKit a 320 y 1440 CSS px.
- **Severidad / prioridad:** P2 / media-baja; reduce claridad y corrección del estado `aria-live`, pero no impide exportar.
- **Causa identificada:** El nombre «sesión completada» cambiaba a singular, pero el adjetivo final «disponibles» era constante.
- **Comportamiento actual / propuesto / consecuencias:** Actual: «1 sesión completada disponibles». Propuesto: «1 sesión completada disponible» y plural correcto para 0 o varias sesiones; solo cambia el copy.
- **Solución aplicada:** Seleccionar singular/plural del adjetivo según el número encontrado.
- **Archivos afectados:** `src/features/settings/SettingsPage.tsx`, `tests/e2e/settings-backup-journey.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** `npm run test:e2e -- tests/e2e/settings-backup-journey.spec.ts` pasó 4/4 Chromium/WebKit, viewports 320/1440 px. Comprueba además filtro vacío, rango invertido, validación sin modalidades, sesión disponible y preparación de ZIP. El estado previo a descargar queda capturado en `evidence/accessibility-2026-11-05/settings-ai-export-preview-{320,1440}px-{chromium,webkit}.png`.
- **Resultado final:** El estado anuncia concordancia singular/plural correcta en la búsqueda cubierta.

### UX-017 — Preparar análisis seguía habilitado sin sesiones seleccionadas

- **Categoría / funcionalidad:** Prevención de errores / exportación de análisis para IA en Ajustes.
- **Descripción:** Tras desmarcar la única sesión disponible, el botón de preparación permanecía habilitado aunque el formulario no tenía ninguna selección.
- **Evidencia:** La regresión E2E pobló la lista con una sesión completada sintética; en ambos motores Playwright observó el botón habilitado tras desmarcar esa sesión.
- **Severidad / prioridad:** P1 / alta para prevención de una acción sin resultado válido y feedback coherente.
- **Causa identificada:** `disabled` dependía solo de que hubiera opciones, no de que hubiera una sesión seleccionada.
- **Comportamiento actual / propuesto / consecuencias:** Actual: acción habilitada con selección vacía y validación solo al activarla. Propuesto: deshabilitar hasta que exista al menos una sesión elegida; se mantiene la lógica de exportación.
- **Solución aplicada:** Condicionar el botón a la existencia de opciones y a `selectedIds.size > 0`.
- **Archivos afectados:** `src/features/settings/SettingsPage.tsx`, `tests/e2e/settings-backup-journey.spec.ts`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas:** `npm run test:e2e -- tests/e2e/settings-backup-journey.spec.ts` pasó 4/4 Chromium/WebKit, 320/1440 px; verifica selección vacía, preview y descarga ZIP con sesión elegida. `npm run check` pasó 960/27 y la E2E global 294/322, 28 omitidas para Emulator/EXTREME, cero fallos.
- **Resultado final:** La acción de preparar no puede ejecutarse desde este estado inválido; no cambian los criterios de elegibilidad ni reglas de negocio.

### UX-018 — El título enfocado tras navegar por teclado no muestra indicador visible

- **Categoría / funcionalidad:** Accesibilidad / navegación SPA desde Planificación a Ajustes.
- **Descripción:** Al activar por teclado «Ajustar fecha y horario», React Router mueve el foco al título «Ajustes» para anunciar el destino, pero el estilo calculado del foco es `outline: none`. El usuario que ve la pantalla y navega con teclado pierde la señal visual del punto de foco después de cambiar de ruta.
- **Evidencia:** Comprobación manual en Chrome a 500×841 CSS px: Tab recorre «Configurar semana» → «Ajustar fecha y horario» con anillo azul visible de 3 px; Enter cambia a `#/settings#exam-date`, el árbol accesible marca «Ajustes» como enfocado, pero `:focus-visible` coincide mientras `getComputedStyle().outlineStyle` devuelve `none`. Tras el arreglo, las capturas `evidence/accessibility-2026-11-05/planning-route-keyboard-focus-{chromium,webkit}.png` muestran el título destino con anillo azul; prueba en `routes.spec.ts`.
- **Severidad / prioridad:** P1 / alta para navegación accesible y continuidad de foco en SPA.
- **Causa identificada:** `src/shared/styles/index.css` aplica `#app h1:focus { outline: none; }`, que prevalece sobre el estilo global `:focus-visible` incluso cuando la navegación se ha iniciado con teclado.
- **Comportamiento actual / propuesto / consecuencias:** Actual: el foco programático del título de ruta carece de indicador visual. Propuesto: retirar la supresión solo cuando el título coincida con `:focus-visible`, conservando la presentación sin anillo para foco programático que no sea visible por teclado. No cambia navegación ni semántica.
- **Solución aplicada:** Acotar la regla de supresión a `h1:focus:not(:focus-visible)` y mantener el estilo global de 3 px para foco visible.
- **Archivos afectados:** `src/shared/styles/index.css`, `tests/e2e/routes.spec.ts`, este registro y el checklist manual.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas de verificación:** `npm run test:e2e -- tests/e2e/routes.spec.ts --update-snapshots` pasó **88/88** en Chromium/WebKit. Incluye 18 rutas, temas claro/oscuro, reflow 320/640 px, servicio offline y la regresión keyboard-route-focus. Esta activa «Ajustar fecha y horario» con Enter, confirma foco en el H1 y outline computado ≥2,5 px, y guarda capturas por motor. Los 40 snapshots que fallaban inicialmente se inspeccionaron: la única diferencia era el anillo intencional en el H1 enfocado; se actualizaron los baselines y se repitió la suite completa en verde.
- **Resultado final:** La ruta de teclado comprobada mantiene una señal de foco visible, sin alterar navegación ni semántica. Verificación manual Chrome y automatizada Chromium/WebKit el 5 de noviembre de 2026. UX-009 permanece abierto para la auditoría completa.

## Registro y cierre

Un hallazgo solo pasa a `CORREGIDO Y VERIFICADO` con referencia a evidencia ejecutada. Los hallazgos históricos no se eliminan; si una hipótesis no se confirma, se cambia a `DESCARTADO, CON JUSTIFICACIÓN` y se conserva la evidencia. Actualizar este registro y los informes vinculados tras cada unidad significativa.

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
- **Solución aplicada:** Tras revisar y confirmar las capturas candidatas, el commit `2420d1b58bc4385df51d7036643262988dedebd9` queda como referencia visual aprobada para comparaciones integrales posteriores. El baseline histórico anterior se conserva en Git.
- **Archivos afectados:** `tests/e2e/snapshots/{chromium,webkit}-darwin/{home,settings,falladas,relampago,trampas}-{light,dark}.png`; fuentes de las cinco rutas referenciadas en UX-004/UX-010 y cambios previos de Inicio/Ajustes.
- **Estado de implementación:** DESCARTADO, CON JUSTIFICACIÓN.
- **Pruebas:** Revalidación `routes.spec.ts` **88/88**; después, `npm run test:e2e:ci` pasó las **72/72** pruebas de referencia Chromium/WebKit y **298/298** pruebas E2E de candidata con **28 omitidas** explícitamente para Auth/Firestore Emulator y EXTREME, sin fallos. Las rutas visuales pasaron en ambos motores y temas.
- **Resultado final:** Las discrepancias se clasificaron como drift de referencia, no como fallos de las capturas candidatas. El commit revisado `2420d1b58bc4385df51d7036643262988dedebd9` quedó establecido como baseline; el histórico anterior continúa en Git. UX-008 se conserva como DESCARTADO, CON JUSTIFICACIÓN. La prueba integral local pasó; esto no equivale a ejecución remota de GitHub Actions.

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
- **Cobertura adicional (5 de noviembre):** la variante E2E `una autoevaluación de recuerdo completo no activa refuerzo prioritario al día siguiente` verifica interacción Parcialmente→Lo recordé el mismo día, reemplazo sin duplicado en `tai.paper-recall.v1.guest`, y ausencia de prioridad para T1.02 tras avance del reloj/reload. Chromium/WebKit **4/4** junto con el recorrido parcial ya existente; capturas `evidence/accessibility-2026-11-05/paper-recall-remembered-next-day-{chromium,webkit}.png`, inspeccionadas visualmente. Sin Firebase ni Gemini.
- **Verificación del corte:** `npm run check` **962 aprobadas/27 omitidas**; el test focal de ambos estados del recuerdo **4/4**; `npm run test:e2e:ci` final **72/72** baseline y **298/298** candidata, **28 omitidas** por suites separadas, sin fallos.
- **Regresión aislada del mismo corte:** `npm run test:e2e:supertest` pasó **12/12** en Auth/Firestore Emulator `demo-tai-auth`; `npm run test:e2e:extreme` pasó **2/2** con 1.000 acciones por motor. No se usó Firebase de producción ni Gemini.
- **Recorrido diario revalidado (5 de noviembre):** `npm run test:e2e -- tests/e2e/css-ui.spec.ts --grep 'Planificación prepara|agenda semanal confirma|pausa de foco se guarda'` pasó **6/6** Chromium/WebKit. Incluye iniciar desde Planificación, confirmar/persistir agenda hasta su fecha efectiva, pausa de foco, recarga, reanudación y comprobación del mismo paso. No modifica código de producto ni reglas pedagógicas.
- **Sesión autenticada entre pestañas (5 de noviembre):** `npm run test:e2e:firebase-auth` pasó **1/1 Chromium** en Auth/Firestore Emulator `demo-tai-auth`; el proyecto omite WebKit para este test de popup Auth. Tras restaurar al owner, una segunda página del mismo BrowserContext recarga Planificación y verifica que la actividad prioritaria y T1.02 siguen presentes; evidencia [`authenticated-peer-tab-planning.png`](evidence/accessibility-2026-11-05/authenticated-peer-tab-planning.png), inspeccionada visualmente. La primera versión falló porque exigía el botón «Cerrar sesión» en Planificación, donde no se muestra; el oráculo se corrigió para comprobar estado de dominio observable. La pestaña paralela se crea únicamente después del ciclo de cambio de identidad, evitando interferencia con la prueba de aislamiento. Este caso verifica pestañas del mismo contexto/navegador, no dispositivos o contextos independientes.
- **Recorrido cross-module adicional:** `npm run test:e2e -- tests/e2e/stats-practice-journey.spec.ts` pasó **4/4** en Chromium/WebKit a 320/1440 px: Progreso → practicar T1.02 → responder las 15 preguntas → Resultado → Progreso. Comprueba respuestas, 15 revisiones, un intento y los 15 registros de respuesta; el resumen de Progreso persiste tras recargar. También desplaza la última opción y verifica que queda antes de la barra fija. Capturas en `evidence/accessibility-2026-11-05/stats-to-topic-test-{initial,readable-option,result}-{320px,1440px}.png`; sin Firebase ni datos remotos. La persistencia comprobada es local y no acredita sync.
- **Ajustes: exportación de análisis para IA:** `settings-backup-journey.spec.ts` prueba rango de fecha invertido, filtro de modalidad sin resultados, validación sin modalidad, selección/deselección, botón bloqueado con cero seleccionadas, resumen/preview y descarga de ZIP tras seleccionar una sesión completada. El mismo test detectó y cerró UX-016 (copy singular) y UX-017 (prevención); pasó **4/4** Chromium/WebKit a 320/1440 px. El ZIP se genera localmente y solo se descarga tras acción explícita; no se transmite.
- **Ajustes: uso sin conexión:** `settings-page.test.js` simula una descarga pendiente, anuncia progreso `1/4`, cancela al cambiar de cuenta, comprueba feedback ante fallo, recupera el botón y permite reintentar con éxito (**11/11** en el archivo). `routes.spec.ts --grep 'shell de Vite, CSP y arranque sin conexión'` pasó **2/2** Chromium/WebKit: descarga real al CacheStorage, valida «disponibles sin conexión», recarga Inicio sin red y comprueba acceso local a explicaciones y fuentes, más shell y fuente Geist.
- **Ajustes y preferencias:** `npm run test:e2e -- tests/e2e/settings-preferences-journey.spec.ts` pasó **4/4** Chromium/WebKit, 320/1440 px. Desde la interfaz cambia Tema a Oscuro y Tamaño de letra a A+++ mediante clic, Enter y Espacio; valida `aria-pressed`, los atributos efectivos, la persistencia en `cfg.ui`, ausencia de overflow y la restauración después de reload. Evidencia: `evidence/accessibility-2026-11-05/settings-preferences-{320,1440}px-{chromium,webkit}.png`. El setup solo siembra al primer documento para no sobrescribir lo que se verifica al recargar.
- **Ajustes y planificación semanal:** `npm run test:e2e -- tests/e2e/settings-training-schedule-journey.spec.ts` pasó **4/4** Chromium/WebKit a 320/1440 px. Cambia minutos del lunes, enfoque del martes y duración del bloque; valida rechazo visible de fecha final anterior, crea un evento sintético, recarga, comprueba preferencias/evento persistidos y lo elimina. Capturas en `evidence/accessibility-2026-11-05/settings-training-{320,1440}px-{chromium,webkit}.png`. Fixture local invitado/propietario sintético; sin Firebase ni producción.
- **Ajustes y borrado de progreso:** `settings-reset-journey.spec.ts` confirma con fixture exclusivamente local que la acción destructiva se ejecuta solo tras aceptación, que el diálogo mantiene el foco entre botones con Tab, devuelve el foco al activador, anuncia el resultado y conserva un estado vacío tras reload. **4/4** Chromium/WebKit a 320/1440 px; evidencias `evidence/accessibility-2026-11-05/settings-reset-{320,1440}px-{chromium,webkit}.png`. No usa Auth ni Firebase Emulator porque el usuario probado es invitado y ningún dato remoto se altera.
- **Fecha objetivo entre módulos:** `settings-exam-target-journey.spec.ts` configura una fecha personal desde el enlace de Inicio, fuerza reload completo, verifica que el valor se conserva, muestra la cuenta atrás y el objetivo con fecha legible en Planificación, y vuelve a Ajustes mediante el enlace de la propia planificación. **4/4** Chromium/WebKit a 320/1440 px; capturas `evidence/accessibility-2026-11-05/settings-exam-target-{planning-,}{320,1440}px-{chromium,webkit}.png`. La semilla sólo usa `tai.v1:guest`; no conecta a Firebase.
- **Copias y análisis para IA en Ajustes:** `settings-backup-journey.spec.ts` pasó **4/4** Chromium/WebKit a 320/1440 px. Exporta JSON con estadística sintética; valida JSON ilegible, cancelación y confirmación; importa una sesión interrumpida y otra completada, dos intentos y cuatro eventos sintéticos; coteja el round-trip y ausencia de duplicados. En el componente de análisis verifica filtro vacío, error sin modalidad, sesión completada, copy singular, habilitación según selección, preview y descarga ZIP. Conserva progreso y preferencias tras reload. Capturas `evidence/accessibility-2026-11-05/settings-backup-{320,1440}px-{chromium,webkit}.png`; fixture sin Firebase.
- **Falladas vacío, poblado y recuperación:** Playwright **8/8** Chromium/WebKit a 320/1440 px prueba búsqueda, no coincidencia, filtros por tema/temario/racha, estado habilitado/deshabilitado, marca tras reload y práctica del enunciado correcto; valida reflow horizontal a 320 px y el objetivo de marca ≥24×24 CSS px. Un test de componente verifica fallo de carga, mensaje `alert`, reintento y recuperación: **2/2** en `failures-page.test.js`. Las capturas pobladas/revisadas están en `evidence/accessibility-2026-11-05/failures-{populated,reviewed-restored}-{320px,1440px}.png`. La simulación de error es un test de componente, no se afirma que Playwright haya inyectado una caída de red.
- **Curación editorial local — retirada y recuperación tras remontar:** `tests/content-map-page.test.js` crea un vínculo sintético válido desde la interfaz, confirma el borrador en `localStorage`, lo retira, comprueba el contador/estado vacío y vuelve a montar la pantalla para verificar que sigue vacío. Focal **5/5** (el test existente de creación ahora incluye la secuencia completa). Sin cambios de producto, Firebase ni Gemini; el borrador continúa siendo local por diseño.
- **Brecha restante:** el inventario cubre controles visibles en estados iniciales y algunos estados dinámicos concretos, pero aún no asocia cada control y estado a una acción y oráculo. Quedan perfiles longitudinales reutilizables de usuario nuevo/progreso parcial/historial extenso, caducidad forzada de token, conflictos de escritura y recuperación multi-dispositivo, además de formularios y diálogos aún sin recorrer. La importación, retirada, aislamiento por cuenta del borrador y sincronización de Planificación entre dos pestañas sí tienen regresiones específicas; no deben figurar como ausencia total de cobertura. Se cierra la brecha específica del round-trip de historial de intentos en la copia local; no se afirma cobertura exhaustiva. Continuar matriz control→acción→resultado y journeys longitudinales/adversariales.
- **Resultado final:** Cobertura ampliada y reproducible, hallazgo todavía abierto hasta cerrar estados dinámicos, continuidad entre módulos y oráculos de dominio en los controles identificados. La suite completa `bridge.spec.ts` pasó **48/48** en Chromium/WebKit tras añadir el caso de configuración; la configuración por sí sola pasó **2/2**.

### ATE-006 — Perfiles CI integrados localmente; ejecución remota pendiente

- **Categoría / funcionalidad:** Automatización / CI.
- **Descripción:** QUICK/INTENSIVE/EXTREME tienen workflows y comandos locales configurados, pero la ejecución de GitHub Actions aún no está demostrada.
- **Evidencia:** Revisión de workflows existentes, registrada en `extreme-platform-status.md`.
- **Severidad / prioridad:** P2 / media.
- **Causa:** `e2e-profiles.yml` se encuentra solo en esta rama; GitHub no permite despacharlo mientras no exista en la rama por defecto. Históricamente no había PR ni ejecución; el 6/11 PR110 activa CI y el run42184320823 ya supera QUICK y Auth. El workflow de perfiles sigue pendiente de registro en default y ejecución remota.
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

### ATE-009 — Vitest recogía pruebas conservadas como evidencia

- **Categoría / funcionalidad:** Integridad del runner de pruebas / descubrimiento de suites.
- **Descripción:** El patrón global `tests/**/*.test.js` incluía una prueba de caracterización guardada en `tests/e2e/evidence/.../evidencia-tecnica/`; sus imports relativos están diseñados para cuando se copia a `tests/`, como explica el informe de auditoría del banco.
- **Evidencia:** `npm run check` no pudo cargar esa suite (`Failed to resolve import "../src/core/application/runs/pending-run.ts"`), aunque los tests de producto completaron 962/962 no omitidos. El archivo, README e informes se encontraban en una carpeta de evidencias nueva y no se modificaron.
- **Severidad / prioridad:** P2 / media; bloqueaba la señal fiable de la suite global.
- **Causa identificada:** Falta de una exclusión para los archivos de prueba archivados bajo la carpeta de evidencia.
- **Solución aplicada:** Excluir `tests/e2e/evidence/**` de la búsqueda de Vitest; las caracterizaciones siguen ejecutables al copiarlas explícitamente a la ubicación descrita por su informe.
- **Archivos afectados:** `vitest.config.mjs`, este registro y el informe de auditoría.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas de verificación:** Tras añadir `exclude: ['tests/e2e/evidence/**']`, `npm run check` terminó con **189 archivos aprobados / 1 omitido y 962 tests aprobados / 27 omitidos**. La primera repetición posterior tuvo dos fallos transitorios de arranque (`app.test.js`, `finish-ui.test.js`); ambos pasaron focalmente **2/2** y `npm run check` volvió a pasar completo. El test del flujo curatorial pasó focalmente **6/6**. `git diff --check` limpio.
- **Resultado final:** Vitest ya no recoge caracterizaciones archivadas como evidencia; las suites normales quedan verificadas. No se modificaron el fixture ni la auditoría documental externa.

### UX-019 — El contador del borrador editorial usa plural con una asociación

- **Categoría / funcionalidad:** Microcopy / borrador local de Curar vínculos a epígrafes.
- **Descripción:** Con una asociación guardada, el título presentaba «Borrador local · 1 vínculos».
- **Evidencia:** El test sintético de cambio de cuenta inspeccionó el título tras cargar el manifiesto de otra cuenta; la primera aserción esperaba singular y reprodujo el plural incorrecto.
- **Severidad / prioridad:** P2 / baja; no bloquea la tarea, pero reduce claridad y corrección del estado.
- **Causa identificada:** El sustantivo «vínculos» estaba escrito como constante, sin depender del contador.
- **Comportamiento actual / propuesto / consecuencias:** Actual: número variable y sustantivo siempre plural. Propuesto: «1 vínculo» y plural para 0 o varios; solo cambia el texto mostrado.
- **Solución aplicada:** Condicionar «vínculo/vínculos» a `manifest.links.length === 1`.
- **Archivos afectados:** `src/features/content-map/AcademyQuestionSectionMapPage.tsx`, `tests/content-map-page.test.js`.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas de verificación:** `npm test -- tests/content-map-page.test.js` pasó **6/6**; incluye estado sin asociaciones, singular, cambio de cuenta ida/vuelta y ausencia de vínculos de la otra cuenta al regresar. `npm run check` pasó con **963 tests aprobados / 27 omitidos**; arquitectura, lint y TypeScript correctos.
- **Resultado final:** El contador muestra concordancia correcta y la regresión comprueba aislamiento entre perfiles.

### UX-020 — La sesión diaria no avanzaba al marcar un tema tras recargar

- **Categoría / funcionalidad:** Continuidad de sesión / Planificación → Temario.
- **Descripción:** Si el usuario recargaba la ruta de un tema abierto como actividad diaria, `pagehide` pausaba el cronómetro. Después, al marcar el tema como estudiado, se registraba el progreso del tema pero la actividad del checkpoint no avanzaba; la autoevaluación planificada quedaba inaccesible desde ese flujo.
- **Evidencia:** Reproducido en el recorrido owner de `tests/e2e/supertest-emulator.spec.ts` con Auth y Firestore Emulator `demo-tai-auth`: tras reload, seleccionar el tema dejaba `currentIndex` en 0 y no mostraba la autoevaluación. La prueba actual verifica recuperación de la misma URL/IDs y avanza a la autoevaluación tras la acción explícita de completar.
- **Severidad / prioridad:** P1 / alta; la interrupción recuperable impedía completar la sesión diaria planificada.
- **Causa identificada:** `completeTrainingSessionActivity` rechazaba toda finalización con `currentStartedAt === null`, aunque la acción explícita llevaba una referencia de sesión/actividad exacta y el contador estuviera pausado por `pagehide`.
- **Comportamiento actual / propuesto / consecuencias:** Actual antes del arreglo: tema marcado, checkpoint sin avance tras recarga. Propuesto: permitir la finalización pausada solo si la referencia recibida coincide exactamente con la sesión y actividad actuales, y no hay una pausa de descanso en curso; conservar el tiempo acumulado. Las llamadas sin referencia o con referencia obsoleta siguen siendo no-op. No se alteran prioridades ni reglas pedagógicas.
- **Solución aplicada:** Se ajustó la guarda de dominio para aceptar ese caso acotado, mantener `elapsedSecondsByActivity` y calcular `completedAt` de forma estable aun sin cronómetro activo.
- **Archivos afectados:** `src/core/domain/study-training-session.ts`, `tests/domain/study-training-session.test.js`, `tests/e2e/supertest-emulator.spec.ts` y evidencia autenticada de recuperación.
- **Estado de implementación:** CORREGIDO Y VERIFICADO.
- **Pruebas de verificación:** Test de dominio **12/12**; `npm run test:e2e:supertest` **12/12** Chromium usando exclusivamente Auth/Firestore Emulator `demo-tai-auth`; `npm test -- --maxWorkers=2` **189 archivos aprobados / 1 omitido; 965 tests aprobados / 27 omitidos**; arquitectura, ESLint, TypeScript y `git diff --check` correctos. No se usó producción ni Gemini.
- **Resultado final:** El recorrido autenticado conserva la actividad tras reload y, al marcar el tema, vuelve a Planificación con la autoevaluación accesible. La evidencia se limita a la identidad sintética y al entorno Emulator.

## Registro y cierre

### ATE-010 — La prueba de vacaciones caduca al cambiar la fecha real

- **Categoría / prioridad:** Fiabilidad de regresión / P2.
- **Evidencia y causa:** `npm run check` del 6/11/2026 falla en `settings-page.test.js`: exige «En curso» para el intervalo 2–5/11/2026 usando el reloj real; el producto correctamente devuelve «Pasado».
- **Solución propuesta / archivos:** Fijar la fecha sintética del test y restaurarla tras cada caso, conservando intervalo y aserción; `tests/settings-page.test.js`.
- **Estado:** CORREGIDO Y VERIFICADO.
- **Verificación / resultado:** 6/11/2026: suites focales 50/50; `npm run check` 966 aprobadas/27 omitidas. Fecha controlada con `vi.setSystemTime` y restaurada; clasificación temporal de producto intacta.

### ATE-011 — Carrera entre salto de pregunta y confirmación en la prueba de cierre

- **Categoría / prioridad:** Fiabilidad de regresión / P2.
- **Evidencia y causa:** `design-flow.test.js` falla intermitentemente al esperar un diálogo inexistente. Dispara salto a pregunta 3, respuesta y botón siguiente antes de esperar que React presente la pregunta destino. El test vecino de vencimiento sí espera índice, `aria-current` y texto «Terminar».
- **Solución propuesta / archivos:** Esperar el estado observable de pregunta 3 y su respuesta guardada antes de finalizar, sin aumentar timeouts ni modificar aserciones de cierre; `tests/design-flow.test.js`.
- **Estado:** CORREGIDO Y VERIFICADO.
- **Verificación / resultado:** 6/11/2026: suites focales 50/50; `npm run check` 966 aprobadas/27 omitidas. Se espera índice, pregunta visible y respuesta guardada; no se aumentan timeouts. No demuestra ausencia absoluta de otras intermitencias.

### UX-021 — El nombre accesible del botón de semana no contiene su texto visible

- **Categoría / funcionalidad:** Accesibilidad, WCAG 2.5.3 / calendario de Planificación.
- **Problema y evidencia:** «Esta semana» usa `aria-label="Semana actual"`. Lighthouse 13.4.1 reproduce `label-content-name-mismatch` en la página local, perfil offline sin Firebase, 500×841, el 6/11/2026. Evidencia: `evidence/accessibility-2026-11-06/planning-before.json`.
- **Severidad / prioridad:** P1; dificulta activar por voz el texto que el usuario está viendo.
- **Causa / propuesta:** Un aria-label redundante reemplaza el texto del botón. Retirarlo para que el texto visible también sea el nombre accesible; conservar acción y presentación.
- **Archivos:** `src/features/planning/StudyCalendar.tsx`, regresiones de Planificación.
- **Estado:** CORREGIDO Y VERIFICADO.
- **Aceptación / verificación:** Botón localizable por «Esta semana», navegación semanal y regreso funcionales; repetir Lighthouse y pruebas de calendario.
- **Resultado:** Verificado el 6/11/2026: regresión de etiquetas/teclado en semana y mes incluida en 24/24 tests de Planificación; Lighthouse final sin `label-content-name-mismatch`, accesibilidad 100 (`planning-final.json`). No representa conformidad global.
- **Ampliación comprobada:** El DOM semanal también muestra «Minutos» con nombre «Duración de actividad semanal». La vista mensual usa «Tema visto» con nombre «Tema del repaso». Se armonizan las etiquetas visibles con los nombres existentes y se verifican los controles etiquetados en ambas vistas con un tema sintético.

### UX-022 — Encabezados y regiones de Planificación tienen estructura ambigua

- **Categoría / funcionalidad:** Estructura accesible y navegación por encabezados / Planificación.
- **Problema y evidencia:** «Preparar esta semana» es H4 inmediatamente bajo la sección H2; Lighthouse detecta `heading-order`. Además, «Semana habitual» (H3) y «Estudio, repaso y descanso» (H2) comparten `planning-week-title`, usado por ambas regiones en `aria-labelledby`; el DOM del navegador confirma los dos IDs.
- **Severidad / prioridad:** P2; jerarquía y nombres de regiones ambiguos para navegación asistida. El salto de encabezados se registra como problema semántico, no como prueba aislada de incumplimiento WCAG completo.
- **Causa / propuesta:** Componentes reutilizan ID y niveles fijos. Asignar ID propio a Semana habitual y usar H3 en los editores hijos directos del calendario H2. Conservar clases, contenido y flujo.
- **Archivos:** `src/features/planning/PlanningHorizon.tsx`, `src/features/planning/StudyCalendar.tsx`, regresiones de Planificación.
- **Estado:** CORREGIDO Y VERIFICADO.
- **Aceptación / verificación:** IDs únicos, regiones con nombres correctos y editores de nivel 3 en semana/mes; Lighthouse sin el fallo reproducido.
- **Resultado:** Verificado el 6/11/2026: 24/24 tests de Planificación; regiones inequívocas, IDs únicos y H3 en ambos editores. Lighthouse final sin `heading-order`, accesibilidad 100. Evidencias antes/después en `evidence/accessibility-2026-11-06/`.

Un hallazgo solo pasa a `CORREGIDO Y VERIFICADO` con referencia a evidencia ejecutada. Los hallazgos históricos no se eliminan; si una hipótesis no se confirma, se cambia a `DESCARTADO, CON JUSTIFICACIÓN` y se conserva la evidencia. Actualizar este registro y los informes vinculados tras cada unidad significativa.

# Registro de hallazgos TAI

## Seguimiento técnico local 2026-11-06

Corrección mínima de `StudyMarkup`: las ramas transparentes y los enlaces descartados devuelven `Fragment` con clave, evitando el aviso React observado en resultados sin cambiar texto, DOM ni política de URL. Regresión unitaria roja antes/verde después; `StudyMarkup` + `design-flow` 45/45 y build correctos. Sin cambios al timeout de `design-flow` ni a Firebase.

Comprobaciones adicionales aisladas desde d3e29bf: Chromium sincroniza temas vistos entre dos contextos con el mismo UID, recupera una marca offline y conserva separación de una tercera cuenta; las reglas rechazan leer el documento del otro UID. Teclado/salto/foco de diálogo pasa en Chromium y WebKit. Batería local **3/4**: WebKit completa las aserciones de datos, pero su control de cero errores falla con dos errores de transporte del SDK al recargar (Write/Listen, 3,6 ms después de reload). Se conserva como limitación, sin silenciarlo ni extrapolar a Safari físico. Cuatro intentos del SDK Firebase 10.14.1 a apis.google.com se bloquearon; cero respuestas externas. OAuth real, VoiceOver, dispositivos físicos y los demás tipos de dato sincronizable siguen sin certificarse. Evidencias y configuración reproducible: `work/technical-followup/` del worktree aislado; el check global final queda a cargo de la integración.

## Implementación Astra 2026-11-05

La auditoría original se conserva íntegra en `evidence/astra-implementation-2026-11-05/astra-original.zip`, junto a su SHA-256 en `provenance.json`. Contiene 16.078 dictámenes y 3.519 incidencias editoriales. `implementation-tasks.json` registra cada ID, prioridad, evidencia, dependencias, riesgo y aceptación. Sus decisiones editoriales requieren verificar las cuatro alternativas de cada pregunta. La publicación del banco en Firestore necesita autorización específica.

|ID original|Hallazgo y causa|Solución y ámbito|Estado|Verificación|
|---|---|---|---|---|
|TEC-01|La reconstrucción desde Drive pierde correcciones y marcas np.|Manifiesto de bytes aprobados, inventario completo, preservación de la edición corregida, candidatos fuera de public y validación antes de la primera petición remota.|CORREGIDO Y VERIFICADO|Reconstrucción aislada, drift, alias, exclusiones y publicador offline.|
|TEC-02|La práctica configurable presenta reloj y nota por parte como examen completo.|Reconstrucción de parejas de supuestos de la misma convocatoria, reservas activadas, perfil oficial con cortes y fórmula documental.|CORREGIDO Y VERIFICADO|Pruebas de selección, reloj y baremos.|
|TEC-03|np afecta nota, intentos y estadísticas en práctica.|Excluir de denominadores e intentos, mostrar solo consulta, filtrar entrenadores.|CORREGIDO Y VERIFICADO|Motor, componentes y 2 recorridos de navegador por motor; Auth/Firestore con dos alumnos ficticios.|
|TEC-04|Detector parcial de figuras omitidas.|Bloqueo de candidatos y cinco exclusiones de evaluación comprobadas en fuentes. Conserva consulta y motivo. Restituir los adjuntos históricos sigue abierto.|CORREGIDO Y VERIFICADO|Las omisiones históricas conservan sus dictámenes por ID.|
|TEC-05|El mismo ID puede reanudarse contra otra clave.|Huella de evaluación ordenada con texto, alternativas, clave y np. Guardado antiguo con respuesta numérica sin huella caduca con aviso.|CORREGIDO Y VERIFICADO|Cambio solo de clave, orden, np, legado, progreso histórico y recarga en Chromium/WebKit.|
|TEC-06|La marca externa verificada y la coincidencia de cita aprueban sin suficiente revisión.|Separar candidatos, documento/hash/página/pasaje, rechazo determinista y revisión independiente vinculada a la propuesta completa.|CORREGIDO Y VERIFICADO|Pipeline Python y candidatos preparados sin acceso remoto.|
|TEC-07|Redondeo ponderado omite temas elegibles y familias.|Asignación factible con cobertura por tema y selección sin variantes repetidas, manteniendo filtros.|CORREGIDO Y VERIFICADO|Casos de capacidad, distribución, alternativas y escenarios.|
|TEC-08|Metadatos de evidencia insuficientes.|Manifiesto lateral compatible para candidatos con fuente, revisión, patrón y justificación de cada opción.|CORREGIDO Y VERIFICADO|Contrato antiguo conservado y aceptación invalidada al cambiar contenido.|

Los estados locales y de producción se registran por separado. Una corrección local probada puede seguir pendiente de publicar en Firestore. Las pruebas documentales acreditan localización, y las decisiones semánticas sin prueba concluyente permanecen en revisión.

Se verificaron 13 correcciones factuales locales (10 P0, 2 P1 y 1 P2) y cinco exclusiones de evaluación por material ausente. Restan 3.501 incidencias editoriales sin corrección, de las que 427 son P0. El usuario autorizó explícitamente las 13 correcciones después de CI e integración. Su ejecución y readback se registran en el PR 107; las demás propuestas no quedan autorizadas por esa aprobación.

Verificaciones del candidato 1.1.13: arquitectura, ESLint, crecimiento de ignores, tipos y 989 unitarias aprobadas con 28 omitidas; ocho comprobaciones Python; Auth/Firestore 1/1; reglas 27/27; 10 recorridos de aceptación en dos motores. El original de main 6b8ce24 pasó 949 pruebas y 27 omitidas en una extracción aislada posterior para obtener referencia sin cambios ajenos. Los logs completos están en evidence/astra-implementation-2026-11-05/. La auditoría de dependencias detecta siete avisos moderados en herramientas de lint (minimatch y sus dependientes); no se actualizaron dependencias ni se aplicó audit fix forzado.

|ID nuevo|Hallazgo|Corrección|Estado|Prueba|
|---|---|---|---|---|
|TEC-09|Una recarga inmediata tras resetAll podía recuperar el espejo IndexedDB anterior.|Generación local por cuenta en snapshot y espejo; recuperación en curso invalida si cambia el estado. El aislamiento de fixtures se refuerza sin quitar comparaciones.|CORREGIDO Y VERIFICADO|Regresión de copia anterior y recuperación posterior de datos nuevos; 77 pruebas focalizadas, diez repeticiones de 61 pruebas cada una.|

Tras resolver TEC-09, la suite general suma 995 aprobadas y 29 omitidas, y el pipeline nueve pruebas. La generación desde planes construye enunciado y alternativas según uno de los seis patrones y conserva la respuesta al reordenar, con prueba de regresión. CI se repite contra este commit antes de integrar.

|TEC-10|WebKit retenía visibilidad obsoleta al montar selectores durante el arranque.|El indicador de listo espera dos fotogramas y cancela callbacks al desmontar. Conserva el bloqueo hasta resolver Auth.|CORREGIDO Y VERIFICADO|12 E2E, cinco unitarias y cuatro capturas idénticas byte a byte frente a 282f692. Arreglo derivado del commit estable ac71bea3; [incidencia del motor](https://bugs.webkit.org/show_bug.cgi?id=326092).|

|TEC-11|La recarga autenticada protegida podía redirigir y eliminar la sesión antes de resolver identidad y permiso; el logout podía volver a la ruta antigua.|Acceso resuelto explícito, reanudación diferida, caché vacía no equivale a revocación, guardado conservado y navegación de logout sin ruta obsoleta.|CORREGIDO Y VERIFICADO|SDK Auth/Firestore reales en emuladores, navegador Chromium con 100 IDs/respuestas/plazo, arranque sin caché y logout; unitarias de red, revocación y carga. Suite completa: 1.002 aprobadas, 29 omitidas.|

Handoff final de integración, publicación de las 13 correcciones autorizadas y despliegue: [PR 107](https://github.com/dramirodev/tai-oposicion/pull/107). Los 3.501 hallazgos editoriales restantes conservan sus IDs y estados originales; veinte propuestas adicionales verificadas permanecen fuera del banco publicado.

|TEC-12 (P1)|Revocar access con el mismo UID detenía la nube, pero el intento privado en memoria seguía admitiendo respuestas y nota local.|Suspensión sin finalizar ni puntuar, checkpoint conservado, muestra pública separada y reanudación con permisos/contexto verificados. Contrato extendido con publicSample opcional; legado privado requiere permiso y el guest conserva compatibilidad.|CORREGIDO Y VERIFICADO|1.004 pruebas, 29 omitidas; Auth/Firestore Chromium 1/1 con revocación/reconcesión y 100 IDs/respuestas/plazo. Histórico por ID/contexto recuperable, callbacks obsoletos sin nota, attemptSession sigue active.|

Seguimiento de la prueba Auth heredada: el refuerzo de T1.02 está primero, con 72 minutos, valoración Parcialmente y fecha correcta. La expectativa nth(1) era obsoleta; se localiza la actividad por título y se conserva el resto del recorrido. Chromium pasó el cambio de día, logout y aislamiento de la segunda cuenta en Auth/Firestore Emulator. Ambos escenarios Auth se incluyen en la configuración dedicada de CI. Fuente del arreglo de test: ac71bea3.

### ATE-012 — Precondiciones de integración de recorridos heredados

- Categoría/prioridad: infraestructura de regresión, P1 para CI. Estado: CORREGIDO Y VERIFICADO.
- Evidencia: integración con main en PR110: bridge busca pestaña «Completo» retirada en favor de «Configurable» (timeout en ambos motores); Auth de main sirve en 4195 y el guard de red heredado solo admitía 4187/9099/8080 (ERR_BLOCKED_BY_CLIENT antes del login).
- Solución: actualizar el nombre visible conservando todas las aserciones; permitir además el puerto loopback 4195 definido en playwright.astra-auth.config.ts, conservando proyecto demo, endpoints y bloqueo externo.
- Archivos: tests/e2e/bridge.spec.ts, tests/e2e/auth-emulator.spec.ts. Verificado 6/11: configuración/persistencia 2/2 Chromium/WebKit y Auth 2/2 Chromium Emulator. No hay cambio de producto.

### ATE-013 — Arranque React del fixture fuera de act

- Categoría/prioridad: fiabilidad de tests, P2. Estado: CORREGIDO Y VERIFICADO.
- Evidencia: dos checks integrados fallan en beforeAll de design-flow esperando Sesión rápida mientras DOM vacío o Suspense «Cargando la pantalla…»; suite aislada 15/15.
- Causa probable: importación inicial que monta React fuera de act y espera el texto con reloj independiente de sus efectos.
- Solución propuesta: importar/montar dentro de act async, conservando timeout y todas las aserciones. Archivo tests/design-flow.test.js. Verificado 6/11: check completo 1.016 aprobadas/29 omitidas y tres repeticiones completas Vitest posteriores con el mismo resultado. Logs en evidence/integration-2026-11-06/. No implica ausencia de toda intermitencia futura.


### ATE-006 — Ampliación de verificación del 6/11

- Revisión del workflow programado: EXTREME omitía QUICK autenticado y `npm run test:e2e` dependía de capturas macOS en un runner Linux. Ahora todos los perfiles ejecutan QUICK; INTENSIVE/EXTREME reconstruyen la referencia aprobada con `test:e2e:ci` y checkout con historial completo. Se conservan las aserciones y el SHA de referencia.
- Se trasladan los mirrors oficiales HTTPS y límites de instalación 15/10 minutos, ya verificados en el run42184320823 (dependencias 68 s; navegadores 17 s). Suites acotadas 15/45/10 minutos y job 90 minutos. Artefactos solo tras iniciar QUICK, evitando presentar evidencia antigua cuando falla la preparación.
- Validación local: YAML parseado con js-yaml, contratos de historial/Auth/baseline comprobados y Prettier correcto. Ejecución remota del workflow programado aún pendiente; no se cierra ATE-006 con estas comprobaciones estáticas.


### Regresión integral de integración — 6/11

`npm run test:e2e:ci`: referencia76/76; candidata306 aprobadas,30 omitidas,0 fallidas (11,5min), código0. Sustituye el resultado inicial292/14/30 para el checkout integrado. Omisiones de perfiles dedicados cubiertas por sus ejecuciones separadas, sin afirmar soporte Auth WebKit/Firefox. UX-007 no presenta regresión. ATE-005 sigue abierto por exhaustividad; inventario actual313 controles observados, todos nombrados, en evidence/integration-2026-11-06. ATE-006: QUICK y Auth remotos aprobados en run42184320823; comparación integral aún en curso al registrar este hito.


### ATE-014 — Fixture de checkpoint con orden temporal inválido

- **Categoría / funcionalidad:** Fiabilidad E2E / continuidad diaria.
- **Descripción:** Dos fixtures de bridge.spec.ts asignaban updatedAt con Date.now() antes de leer startedAt; un cambio de milisegundo hace updatedAt < startedAt.
- **Evidencia:** CI42184320823 termina con305 aprobadas/30 omitidas/1 fallo Chromium Linux esperando «Continuar actividad». El adaptador rechaza y elimina expresamente el checkpoint con esa desigualdad; prueba de frontera reproduce el rechazo con1ms y acepta timestamps iguales. Sin trace remoto disponible en ese run, la correlación con el fallo remoto se confirma en la próxima ejecución, no por suposición.
- **Severidad / prioridad:** P1 / alta, señal CI no fiable.
- **Causa:** Fixture temporal no atómico. Hipótesis inicial de estado React obsoleto no corroborada: el servicio lee localStorage al obtener el checkpoint.
- **Solución:** Reutilizar date.getTime() para ambos campos. No modificar validador, reglas de negocio, aserciones ni timeout.
- **Archivos afectados:** tests/e2e/bridge.spec.ts; tests/adapters/training-session.test.js; fixture equivalente de tests/sync.test.js.
- **Estado de implementación:** CORREGIDO SIN VERIFICAR.
- **Pruebas:** Adaptador10/10; repetición E2E20/20 (2 recorridos ×2 motores ×5 repeticiones), 2,2min. npm run check:1017 aprobadas/29 omitidas; arquitectura/lint/tipos correctos. Nueva CI Linux pendiente.
- **Resultado final:** Defecto del fixture corregido; pendiente confirmar repetición y señal remota. ATE-006 permanece abierto.


### ATE-005 — Perfiles locales reutilizables en Progreso (6/11)

Fixtures versionados new/partial/extensive de0/2/300 sesiones en tests/e2e/fixtures/study-profiles.ts. Journey tests/e2e/stats-study-profiles.spec.ts verifica comparación, límite visual15, todas las opciones, recarga sin duplicados/pérdidas y reflow320.6/6 Chromium/WebKit; evidencia en evidence/study-profiles-2026-11-06. Primera pasada2/6 por forma incompleta del fixture, normalización respetada y fixture corregido. No es prueba de perfiles autenticados longitudinales ni multi-dispositivo; ATE-005 sigue EN CORRECCIÓN.


### ATE-005 — Inventario dinámico autenticado y regresión de integración (6/11)

Supertest12/12 sobre demo-tai-auth, propietario sintético: Oficial2025(11), Por examen(38), Por tema(48) =97 observaciones de controles, cero nombres vacíos; se comprueba pestaña activa y, en listas, selección final y acción Estudiar habilitada. JSON incluye estado/acción/oráculo y árbol con cajas. Evidencia `evidence/dynamic-controls-2026-11-06/`. Son observaciones, no porcentaje ni prueba individual de cada control. ATE-005 permanece abierto.

Última integración1.1.16: E2E global306 aprobadas/30 omitidas/0 fallos (11,7min), más6/6 nuevos perfiles locales por separado. Check1046/29 omitidas. CI42190272937 aún en curso: resultado remoto pendiente.

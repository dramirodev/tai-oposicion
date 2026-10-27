# Handoff — migración React, Shiki, auditoría CSS y arquitectura

Fecha: 2026-10-26 (Europe/Madrid)

## Rama y PR actuales

- Checkout activo para arquitectura: `/tmp/tai-architecture-audit`
- Rama activa: `docs/architecture-audit-stack`, actualizada sobre `main` tras integrarse la PR #34.
- PR #34: [migrar pantallas restantes y modernizar presentación](https://github.com/dramirodev/tai-oposicion/pull/34), integrada en `main` mediante merge commit `095a0e1`.
- PR #36: abierta contra `main`, actualizada en `2fe3c3b`; nueva validación remota pendiente, no esperada.
- PR #37: abierta y apilada sobre #36, actualizada en `9da9fcb`; nueva validación remota pendiente, no esperada.
- PR #38: propuesta de arquitectura, reapuntada a `main` tras el merge de #34.
- El run anterior `40373734672` falló solo en 68 comparaciones visuales Linux; el baseline quedó actualizado en `32796db` y el flujo completo pasó localmente en macOS.
- No cambiar al checkout `/Volumes/SSD/develop/PWA_TAI`; está obsoleto para este trabajo.
- `node_modules` se reinstaló localmente en este checkout para añadir Shiki; no versionarlo.

## Orden recomendado de trabajo pendiente

1. **Revisar #36 y #37:** #36 ya apunta a `main`; #37 permanece apilada sobre #36. Corregir fallos reales cuando se reproduzcan; no esperar a que pasen las pipes.
2. **Recharts:** auditar las gráficas de datos reales en una rama nueva desde `main`; migrar solo las que ganen interacción, accesibilidad o mantenibilidad y medir el tamaño del bundle.
3. **Arquitectura Etapa A:** propuesta documental completada en la PR #38, ahora contra `main`; esperar aprobación antes de Etapa B.
4. **Etapa B y Zustand:** solo tras aprobación; empezar por Progreso de solo lectura, extraer límites gradualmente y añadir Zustand solo para estado efímero compartido que lo justifique.
5. **Después de cerrar las tareas activas:** abrir rama independiente para evaluar migrar tests a React Testing Library y decidir si Jest aporta algo frente a Vitest.

## Estado de migración

Migradas previamente a React y presentes en PR #34: Tarjetas, Falladas, Relámpago, Detective de trampas y Lectura atenta. Ajustes se migró a `SettingsPage.tsx`, ruta lazy, servicio tipado y previsualización/importación segura de copias; se eliminó `src/features/settings/legacy.ts`. En esta continuación se migraron `/test`, `/sim`, `/sim2`, `/quiz`, `/result` y `/stats` a páginas React lazy; `/examenes` quedó como redirección React. Se retiraron los renderizadores y entradas `legacyPaths` ya sustituidos.

La comprobación de arquitectura actual dio `sin deuda nueva; 64 excepciones pendientes`.

`/quiz` conserva respuesta, ayudas, subrayado, confianza, revisión y tiempo; `/result` conserva revisión y estrategia; `/stats` mantiene los datos y métricas existentes. Se eliminó `src/features/stats/legacy.ts` y el renderizador de evolución ya sustituido. Rutas pendientes de migrar: ninguna identificada en la lista actual.

## Cambios publicados en PR #34

- `src/features/failures/FailuresPage.tsx`: añadida marca `data-reviewed` para que las pruebas comprueben persistencia desde la nueva vista React.
- Migración de Test/Simulacros: `src/features/test/TestPage.tsx`, `src/features/test/test-controller.ts`, `src/features/simulation/SimulationPage.tsx`, `src/features/simulation/SimulationReviewPage.tsx`, `src/app/ExamsRedirect.tsx` y servicios/rutas asociados.
- Nuevas páginas y composición: `src/features/quiz/QuizPage.tsx`, `src/app/quiz-composition.ts`, `src/features/result/ResultPage.tsx`, `src/features/stats/StatsPage.tsx`, `src/app/stats-composition.ts`.
- Shiki: `src/shared/ui/StudyCode.tsx`, integración en `StudyMarkup.tsx`, estilos en `home.css` y `question.css`, dependencia en `package.json`/lockfile y prueba en `tests/study-markup.test.js`.
- Hay además actualizaciones a pruebas unitarias, E2E y snapshots de rutas en Chromium/WebKit y tema claro/oscuro.
- La migración, Shiki, pruebas y snapshots están publicados en PR #34. El commit `32796db` añade el baseline aprobado y esta ronda no toca esos cambios.


## Últimas validaciones y fallos observados

- `npm run check`: pasó: arquitectura sin deuda nueva (64 excepciones previas), ESLint, ignore-growth, TypeScript y **402 tests / 89 archivos**.
- `npm run build`: pasó. Shiki queda en un chunk de 170.53 kB (56.46 kB gzip); los temas son 11 kB cada uno y las gramáticas se cargan bajo demanda. Persisten avisos anteriores de `index` 513.27 kB y `legacy-sync` 549.48 kB.
- E2E completo antes de Shiki: 149/150. El caso Chromium de subrayados/reanudación no encontró el diálogo tras recargar; ejecutado por separado pasó 1/1. El resto pasó.
- Un intento de suite unitaria combinada falló en `finish-ui`; aislado pasó y la siguiente suite completa pasó 402/402.
- `tests/study-markup.test.js` comprueba que se resalta SQL y se conserva el texto.
- Capturas de rutas migradas fueron revisadas antes de Shiki en Chromium/WebKit, claro/oscuro; falta inspeccionar el resultado con Shiki y ajustar capturas únicamente tras revisar el cambio visual.


## Shiki integrado

Context7 resolvió `/shikijs/shiki`. `src/shared/ui/StudyCode.tsx` usa un `HighlighterCore` singleton con motor JavaScript regex, temas GitHub Light/Dark y gramáticas SQL, JavaScript/TypeScript, Python, Java, C, HTML, CSS y Bash. Shiki y la gramática necesaria se cargan solo al representar un bloque de código. Convierte los tokens a elementos React; el texto en línea se conserva y si falla Shiki se ve el código original. El color dual sigue `data-color-scheme` y los tokens CSS `--code-bg`/`--code-ink`.

Se descartó la importación general `import('shiki')` porque Vite incluyó cientos de lenguajes y un fragmento C++ de 869 kB. La versión actual usa `shiki/core`, `shiki/engine/javascript` y cargas dinámicas explícitas, verificado en el build.


## Auditoría CSS solicitada

Skills disponibles y localizadas:
- `/Users/dramiro/.agents/skills/design-taste-frontend/SKILL.md` — leído; para pantallas de aplicación leer `references/app-screens.md` completo y usar inspección visual/loop de capturas.
- `/Users/dramiro/.agents/skills/web-design-guidelines/SKILL.md` — leído; se obtuvieron las reglas actuales desde `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`.

La auditoría CSS detallada y sus resultados están registrados en la sección “Auditoría CSS (corte 2026-10-26)”. No repetirla desde cero al retomar: validar el árbol actual y atender solo regresiones o puntos explícitamente pendientes.

## Auditoría CSS (corte 2026-10-26)

- Inventario: 12 hojas CSS compartidas, 2.364 declaraciones. Stylelint no está configurado ni instalado; no se añadió otra dependencia.
- Se revisaron duplicados, `!important`, medios de movimiento reducido, tokens y estilos inline. Los dos pares `max-height` duplicados en `.bar2` y el modal preservan fallback `vh` + `dvh`. Las tres reglas `!important` atienden `prefers-reduced-motion` o `[hidden]`; se conservaron por su función.
- Se limpiaron valores redundantes dentro de `.dmt` (padding/gap/base ancho de borde repetidos). La auditoría de AST ahora encuentra solo esos dos duplicados deliberados.
- Se normalizó en `rem` el conjunto de tokens de espaciado, radios, anchos de contenido/sidebar, ancho de estudio, gutter y altura de controles. También se convirtieron a `rem` las dimensiones CSS que no son bordes, outlines, sombras, breakpoints ni detalles de precisión; fuentes directas se expresan en `rem`. Permanecen 110 usos de `px`, incluidos bordes, focos, sombras, breakpoints y fallbacks concretos.
- Medición Playwright en claro/tamaño normal: 18 rutas × 8 tamaños (320, 375, 430, 768, 1024, 1280, 1440, 1920), cero overflow de página. El primer script de modo oscuro/tamaño máximo no preservó preferencias al recargar cada ruta; tras corregirlo se midieron 18 × 8 vistas, con pestaña Evolución activa en Progreso.
- Esa pasada correcta descubrió que un `<select>` etiquetado de “Qué medir en la evolución” desbordaba en Stats a 320/375px. Se corrigió en `.row>label>select` (ancho acotado) y se añadió prueba E2E para claro/oscuro, texto máximo, Chromium/WebKit. Las cuatro pruebas pasan. Segunda medición: 144 vistas en oscuro/tamaño máximo, cero overflow de documento.
- Taste app inspector después del remap: `stats` tiene avisos `below-fold` (2/8 bloques) y `no-data-hue`; `home` y `settings`, aviso `below-fold`. Se inspeccionaron las capturas de Stats y Home, contraste de texto 5.3:1 y 5.7:1; Settings 15.8:1; overflow 0 a 1440/768/390. El warning de hue es falso positivo: en la captura Stats está activa la pestaña Temas y no hay gráfico visible; los gráficos reales están en pestañas separadas y el trazo usa `--selb`. El below-fold de Stats incluye el mapa de los 36 temas y análisis largos; Inicio deja a la vista acción de estudio y repaso; Ajustes tiene 11 secciones. Se conserva su contenido y navegación por pestañas/scroll.
- Cierre técnico de CSS: contraste de texto Taste medido en Inicio 5.7:1, Progreso 5.3:1 y Ajustes 15.8:1; auditoría de foco/teclado existente cubierta por E2E. `npm run check` pasó con 402 tests, build de producción y Playwright completo pasaron; Stylelint no está configurado ni instalado.

## Integración Lucide React (corte 2026-10-26, parcial)

- Context7 consultó la biblioteca Lucide y confirmó el paquete y las props `size`, `strokeWidth` y atributos SVG.
- Se añadió `lucide-react` como dependencia (sin vulnerabilidades nuevas reportadas por npm).
- Navegación lateral e inferior, accesos rápidos de Inicio, menú, ayuda contextual de tarjetas/Ajustes y encabezado de Detective usan iconos Lucide con `currentColor`, `aria-hidden`, tamaño `rem` y trazo consistente.
- Se eliminó `src/shared/ui/help-icon-link.ts`, que generaba SVG manual repetido y solo quedaba como tipo para React; `HelpIconLink.tsx` ahora contiene el tipo y presentación compartidos. Las curvas SVG de Progreso permanecen porque son visualizaciones de métricas.
- No se cambiaron logotipos ni recursos de marca. Quedan emojis semánticos en indicadores de estudio (por ejemplo, acierto por suerte) y en el router legacy; decidir su migración solo si continúan visibles tras el cierre de la migración.
- Primera auditoría Taste previa: iconos sin fondos tintados, overflow 0; avisos `below-fold` defendidos por la longitud real de Inicio/Ajustes/Progreso y `no-data-hue` no aplica a la vista de Temas sin gráfico. La segunda pasada Taste en Inicio después de Lucide confirma composición, legibilidad y overflow 0 en 1440/768/390; warning `below-fold` sigue siendo deliberado porque Inicio incluye más bloques funcionales que el primer viewport.
- Último `npm run check`: 89 archivos, 402 tests aprobados. `npm run build`: aprobado; advertencias de tamaño en `index` (~522 kB) y `legacy-sync` (~549 kB). Playwright `--update-snapshots`: 154/154 casos aprobados en Chromium/WebKit; capturas de rutas actualizadas en claro y oscuro.
- El hook local al crear el commit mostró 17 diagnósticos React Doctor en el área modificada: complejidad de cuatro páginas, `useEffect` con callback cambiante, claves de array por índice, búsquedas de array dentro de un bucle, foco anidado en una opción de Quiz, modal propio y promesas `.then` en manejadores de Stats. `anchor-target-exists` para `#app` parece falso positivo porque `index.html` contiene `<main id="app">`. No se han suprimido ni triageado los demás; al reanudar, confirmar cada uno con el código y resolver los verdaderos positivos antes de cerrar la deuda.

## PR #34 — fallo de referencia visual y corrección

- El job pasó arquitectura/lint/tipos/tests, build y validación de preguntas; falló solo en `Reconstruir referencia visual y verificar Chromium y WebKit`.
- `baseline-ref.txt` apuntaba a `448758581b356f6705ea42a4b185e4cd062cf479`, UI anterior a las páginas React y al rediseño. El runner generó desde ese commit referencias Linux y halló 68 capturas distintas en la candidata; no hubo fallos funcionales en la suite (86 casos pasaron).
- Commit `32796db` actualiza `tests/e2e/baseline-ref.txt` a `3239d0a4876d4418617c227617ed50f9c182c3ef`, que contiene la UI migrada y será ancestro en `main` tras fusionar #34.
- `npm run test:e2e:ci` local pasó: 68 capturas regeneradas en Chromium/WebKit, claro/oscuro, y luego 154 E2E. El entorno local es macOS, no Linux; el nuevo run de GitHub todavía está pendiente.

## Propuesta arquitectónica Etapa A

El usuario pidió una auditoría completa del proyecto y definió Etapa A y Etapa B. Tras completar el trabajo actual:

- La rama `docs/architecture-audit-stack` se creó sobre PR #34, se rebasó a `main` (`095a0e1`) tras su integración y se publicó en la PR #38 contra `main`.
- Inspeccionar todo el repositorio antes de modificar código.
- En Etapa A no cambiar código de producción. Documentar `docs/architecture/audit.md`, `target-architecture.md`, `dependency-rules.md`, `migration-plan.md` y `migration-report.md` con arquitectura real, reglas, diagrama, funcionalidades/casos de uso reales, riesgos y prioridades.
- Abrir PR contra `main` cuando la propuesta esté concreta. Presentarla al usuario y esperar su aprobación antes de Etapa B.
- En Etapa B, migración funcional gradual con tests y gates; sin cambiar contratos persistidos, seguridad, rutas públicas, UI o comportamiento sin necesidad.

## Estado de las PR tras el merge de #34

- PR #36 falló en CI porque la aserción del modal de fin de simulacro usaba el timeout por defecto de 1 segundo. Se amplió la espera de ese modal a 5 segundos; `npm run check` pasó con 402/402 tests y la rama se rebasó a `main` en el commit `2fe3c3b`. El nuevo run está pendiente y no se esperó.
- PR #37 falló en las cuatro capturas de Relámpago: CI reconstruía su referencia con la UI anterior a Lucide. Tras revisar el cambio visual, `baseline-ref.txt` apunta al commit Lucide revisado `dad1ec6`; Playwright enfocado pasó 4/4 entre Chromium/WebKit y claro/oscuro. La rama sigue apilada sobre #36 y el nuevo run está pendiente.
- PR #38 contiene la auditoría arquitectónica, está rebasada en `main` y queda pendiente de revisión/aprobación de Etapa B.
## Nota de continuidad

El observador de `claude-mem` informó que su cuota semanal está agotada: “Claude rejected the request because its weekly usage allowance is exhausted.” No reiniciar el worker. Este documento y el work state `continuar-migracion-shiki-css` conservan la continuidad.

## Actualización de continuidad — estado vigente

Corte 2026-10-26: PR #34 se integró en `main` mediante `095a0e1`. PR #36 ahora apunta a `main`; PR #37 se mantiene apilada en #36. PR #38 es la propuesta arquitectónica contra `main`. Recharts se está trabajando en `/tmp/tai-recharts-audit`, rama `feat/recharts-study-visualizations`, ya creada desde la punta de PR #34; rebasarla a `main` antes de implementar/publicar. La auditoría y cinco documentos de arquitectura están en la PR #38; no hay cambios de producción en esa tarea ni se ha iniciado Zustand.

La inspección confirmó que `legacyPaths` está vacío y las páginas públicas tienen rutas lazy. `App.tsx` todavía consume `studyServices` y arranca `bootLegacy` desde `legacy-router.ts`; `core/application/legacy-engine.ts` sigue dependiendo de tres módulos de adapters/legacy. `npm run check:architecture` volvió a pasar sobre `main` con 64 hallazgos baseline y cero deuda nueva.

Orden propuesto actualizado:

1. Completar auditoría/migración de Recharts en rama propia desde `main`; abrir PR tras validar beneficio real.
2. Esperar aprobación de la propuesta #38 antes de iniciar Etapa B de arquitectura; empezar con Progreso de solo lectura.
3. Reducir el contrato global de servicios por feature y evaluar Zustand solo para una rebanada efímera realmente compartida; no mover estado local ni datos persistidos.
4. Desacoplar `legacy-engine.ts` con puertos/adaptadores probados; luego separar composición/arranque y retirar código HTML legacy tras búsqueda de referencias.
5. Cerrar mappers/tipos antiguos y añadir control de ciclos. Después de las tareas activas, crear rama aparte para migrar tests a React Testing Library y evaluar Jest.

**Etapa A terminada y publicada en la PR #38 contra `main`**; Etapa B pendiente de aprobación. Archivos de propuesta: `docs/architecture/audit.md`, `target-architecture.md`, `dependency-rules.md`, `migration-plan.md`, `migration-report.md`.

## Estado de continuidad — actualización 2026-10-26, noche

Esta sección reemplaza los estados de PR anteriores que aparecen en el historial del documento:

- PR #34 está integrada en `main` (`095a0e1`).
- PR #36 también está integrada en `main` (`609dbc8`).
- La PR #37 quedó cerrada sin merge; GitHub no permitió reabrirla tras recrear/rebasar su rama. La misma integración de Lucide se volvió a publicar contra `main` como PR #39: https://github.com/dramirodev/tai-oposicion/pull/39.
- PR #38 contiene la propuesta de arquitectura y apunta a `main`; Etapa B permanece pendiente de aprobación explícita.
- La rama `feat/recharts-study-visualizations` está en `/private/tmp/tai-recharts-audit`, basada en `609dbc8`. La integración está en curso; los gráficos migrados deben quedar cargados de forma diferida dentro de las secciones de estadísticas.

### PR #38 — corrección del fallo E2E

El fallo remoto en `tests/e2e/bridge.spec.ts` ocurría porque la prueba de explicación offline heredaba `serviceWorkers: 'block'`, interceptaba el índice con una respuesta simulada y después desconectaba el navegador. No comprobaba la caché del service worker real y sus dos mensajes de carga fallida hacían fallar la aserción global.

La prueba ahora permite el service worker real, siembra el índice en la Cache Storage instalada, desconecta antes de revelar la explicación y verifica que la explicación y el índice siguen disponibles después de recargar offline. En modo offline solo se toleran fallos de actualización de ese índice y solicitudes externas conocidas de Firebase/Google; otros fallos siguen haciendo fallar la prueba.

Validación local en la rama de #38: prueba focalizada 2/2 (Chromium y WebKit), `npm run check` (402/402 unitarios y arquitectura sin deuda nueva), suite E2E completa 154/154 y `git diff --check`. El build se ejecuta como parte del servidor de E2E. El run remoto anterior falló en el test antiguo; al publicar la corrección, revisar su nuevo resultado si el usuario vuelve a reportar un fallo.

### Siguiente trabajo autorizado

1. Terminar la integración de Recharts en `/private/tmp/tai-recharts-audit`: migrar las gráficas justificadas en `StatsSimulationSection` y `StatsEvolutionSection`, mantener sus importaciones diferidas, verificar datos, responsive, teclado, tema claro/oscuro y estados sin datos; eliminar únicamente el SVG/CSS sustituido.
2. Ejecutar `npm run check`, `npm run build`, prueba E2E focalizada y suite E2E completa; documentar auditoría, decisiones, dependencias y validación en este handoff.
3. Publicar una PR separada contra `main`, sin esperar sus pipelines.
4. Esperar aprobación del usuario para Etapa B arquitectónica/Zustand, conforme a la petición original de Etapa A.
5. Al cerrar las tareas autorizadas, abrir una rama separada para evaluar React Testing Library y si Jest aporta valor frente a Vitest.

## Integración de Recharts — trabajo en curso

### Auditoría y decisiones

- `src/features/stats/StatsPage.tsx` tenía una línea SVG propia para la nota de simulacros y la evolución semanal de acierto/tiempo.
- `src/features/stats/StatsEvolutionSection.tsx` tenía otra línea SVG propia para preguntas vistas, acertadas, falladas y “No lo sé”. Son métricas existentes y la migración conserva sus datos y tablas.
- Migración recomendada y aplicada a esas tres visualizaciones porque Recharts aporta ejes/fechas, tooltips, navegación por teclado y adaptación al contenedor.
- Los indicadores de dominio, barras de avance y tablas se mantienen: son mejores representaciones para sus datos y no necesitan un gráfico.
- No había una biblioteca de gráficos anterior ni Tailwind/shadcn. No se introdujo shadcn ni un sistema CSS nuevo; los gráficos usan los tokens CSS ya existentes.

### Arquitectura e implementación

- Añadida dependencia `recharts` 3.10.1.
- `src/features/stats/StatsCharts.tsx` concentra `StatsTrendChart` y `QuestionEvolutionChart`, con etiquetas y descripciones accesibles, ejes/fechas localizados, tooltips, colores semánticos y animación desactivada.
- `StatsSimulationSection` y `StatsEvolutionSection` cargan los gráficos con `React.lazy` y `Suspense`; el código se descarga cuando se abre la sección que lo necesita. La tabla semanal y la comparación de intentos siguen proporcionando la misma información sin depender del color.
- Los estados sin datos y de carga tienen texto explícito. CSS mantiene altura válida para `ResponsiveContainer` y compensa el `zoom` de la aplicación en el tamaño observado.
- Retiradas las reglas SVG manuales que ya no tenían consumidores (`.evo`, `.gl`, `.gt`, `.ln`, `.pt`, `.vl`, `.evolution-hit` y `.tip`). Actualizada la guía local de estilos.
- El hook React Doctor reportó `prefer-dynamic-import` en el import interno de Recharts. Se clasifica como falso positivo: los padres cargan `StatsCharts` mediante `React.lazy` y el build emite `StatsCharts` como chunk separado. No se desactivó ni suprimió la regla.

### Validación actual

- `npm run check`: pasó en una ejecución (402/402 tests, lint, TypeScript y arquitectura: 64 hallazgos baseline, cero deuda nueva). En repeticiones posteriores apareció una sola prueba intermitente, alternando entre `design-home-stats.test.js` y `app.test.js`; en ambos casos el mismo test pasa al ejecutarlo aislado. No se cambiaron ni relajaron esas pruebas.
- `npm run build`: pasó. `StatsCharts` es un chunk de 363.68 kB (107.24 kB gzip), separado de la entrada y cargado al usar estadísticas. Los avisos de tamaño preexistentes de `index` (523.44 kB) y `legacy-sync` (549.49 kB) siguen pendientes.
- `npx playwright test tests/e2e/stats-charts.spec.ts`: 6/6 Chromium/WebKit; puntuaciones reales, tooltip con teclado, temas claro/oscuro, anchos 320/1440, ausencia de overflow y estado vacío.
- `npm run test:e2e`: 160/160 Chromium/WebKit en local.
- La prueba offline heredada de explicaciones fallaba en `main` porque bloqueaba service workers y simulaba su respuesta. La corrección que usa el worker/caché reales ya está integrada con PR #38 (`05a6ac8`), por eso no aparece como diferencia propia de esta rama.
- Stylelint no está instalado/configurado en el proyecto. La revisión visual se apoyó en Taste y en E2E de navegador; no certifica dispositivos físicos.

## Estado vigente — continuación solicitada el 2026-10-27

La instrucción más reciente pide continuar las tareas pendientes hasta terminarlas. Esta autorización retoma la Etapa B arquitectónica/Zustand que la solicitud original había dejado detrás de aprobación. Mantener entregas separadas y no fusionar ni desplegar sin instrucción explícita.

### Estado de PR y base

- `origin/main` verificado en `d745aa68e45385fd1625907af6e63ec3da1084b7`; ya incluye las PR #40 (Recharts), #39 (Lucide), #38 (auditoría arquitectónica) y #42 (Testing Library).
- El checkout principal sigue desactualizado y conserva un cambio local ajeno en `tests/design-training.test.js`; no usarlo como base ni modificar ese archivo.
- PR #43 (`fix/menu-iconography-mobile-hover`) se creó basada en el `origin/main` previo `ddf63c8`. Al integrarse la PR #40 hubo conflictos en este handoff y `progress.css`; se integró `d745aa6` y GitHub volvió a marcar la rama como `MERGEABLE`. El check fallido previo (run `40462333327`) contenía una llave CSS sobrante ya retirada; el nuevo run del head `46ca6be` estaba en cola en la última consulta.
- PR #41 quedó cerrada como duplicado tras la fusión de #39. La validación remota de #40 terminó `SUCCESS` en run `40458561840` y la PR fue fusionada.

### Iconos de menú y hover táctil

- Auditoría: el menú móvil de rutas carecía de iconos y el menú general legacy usaba emoji/caracteres, mientras la navegación usa Lucide outline. Se creó `src/app/navigation-icons.ts`; ambos menús y la barra usan el mismo catálogo y grosor. `MenuGroup` ahora recibe componentes Lucide tipados.
- Los selectores `:hover` se limitan a `(hover: hover) and (pointer: fine)`. Se conservan estilos de foco, ruta actual, respuesta elegida y la pulsación breve `:active`.
- Validación local antes de integrar #40: build; arquitectura (64 excepciones base, sin nuevas), ESLint, ignore-growth, TypeScript; Vitest serial 402/402; E2E 156/156 (Chromium/WebKit). La ejecución concurrente inicial mostró dos carreras en tests de diálogos que no se reprodujeron en serie.
- Tras el merge de #40: `npm ci` añadió 567 paquetes sin vulnerabilidades; build correcto. E2E focalizada CSS/menú/gráficas 40/40 Chromium/WebKit; la suite completa 156/156 había pasado antes del merge de #40. El check serial posterior tuvo una carrera en `tests/app.test.js` (401/402); ejecutar ese archivo aislado pasó 1/1. La prueba no se modificó porque no se reprodujo aislada y no está relacionada con estos cambios.
- Próximo paso: publicar la resolución de la base y verificar el nuevo estado de PR #43; después continuar la arquitectura apilada sobre la última punta de #43.

### Arquitectura Etapa B — progreso y pendientes

La rama `feat/architecture-stats-slice` parte del head de PR #43 (`46ca6be`) y ya contiene un primer slice local:

- Movidos los modelos de respuesta de estadísticas a `src/core/application/stats/statistics-model.ts` y sus imports de composición/UI actualizados.
- Extraída `summarizeTopicProgress` a `core/application` con transformación tipada; se conserva el umbral de 8 respuestas, el orden ascendente de rendimiento y el límite de 5 temas. Nueva suite de 2 casos.
- Validación: `npm run check:architecture`, ESLint, ignore-growth, TypeScript; Vitest serial **404/404**; build; Playwright de Progreso/gráficas **10/10** Chromium/WebKit.
- Todavía no hay un puerto separado para esos valores: hoy se leen en la composición y se pasan normalizados a la función pura; revisar el límite de lectura antes de extraer interfaz.
- PR #44: https://github.com/dramirodev/tai-oposicion/pull/44, rama `feat/architecture-stats-slice` @ `3d2f928`, apilada sobre la PR #43 por el handoff compartido. Era `MERGEABLE` y su check estaba `IN_PROGRESS` en la última consulta.
- PR #43: sigue `MERGEABLE`; el check asociado a `46ca6be` estaba `CANCELLED`. No se conoce la causa; el código posterior pasó `npm run build`, Vitest serial, 40 E2E tras actualizar base y 10 E2E de estadísticas en esta rama.
- Siguiente: un slice separado para Zustand. Context7 documenta `/pmndrs/zustand` v5.0.12 con store vanilla y `useStore` selectivo. Migrar solo diálogos/toasts si reduce notificaciones/renderizados; conservar pruebas de teclado, foco y cierre.
- Siguen pendientes: reducir `StudyServices` por feature; eliminar dependencias de adapters de `legacy-engine`; separar bootstrap/composición de `legacy-router`; encapsular DTOs legacy; incorporar comprobación de ciclos y terminar gates de arquitectura.

No adoptar automáticamente el plan antiguo `modernizacion-sin-legacy`: las rutas de producción se migraron en #34 y los registros anteriores al merge están superados. La rama externa de renombres `/Volumes/SSD/develop/PWA_TAI-mejoras-estudio` tiene cambios locales no publicados; inspeccionarla en su propio checkout antes de decidir su vigencia y preservarlos.

## Continuación — Zustand y siguiente slice arquitectónico (2026-10-27)

### Zustand: COMPLETADO LOCALMENTE, PR PENDIENTE DE PUBLICAR

- Rama `/private/tmp/tai-architecture-zustand-store`, `feat/architecture-zustand-dialog-store`, basada en la punta de PR #44 para conservar la cadena de cambios. La PR #44 está abierta y apilada sobre #43; no afirmar que sea parte de `main` hasta que ambas se fusionen.
- Dependencia añadida: `zustand` `^5.0.12` (lockfile v5.0.16; store vanilla documentado con Context7 `/pmndrs/zustand`).
- `src/shared/ui/dialog-store.ts`: sustituido el emisor manual `DialogStateStore` por `createStore` vanilla de Zustand. La API que usa código no React se mantiene mediante `getState()`.
- `src/shared/ui/dialogs.tsx`: componentes `ToastView` y `DialogStack` leen `toast` y `dialogs` con selectores `useStore` separados para que un cambio en uno no vuelva a dibujar el otro. El temporizador, IDs, control de un menú, promesas de respuesta y retorno del foco permanecen.
- Alcance limitado: solo estado temporal de UI; ninguna persistencia, progreso, sesión o dato de dominio se mueve a Zustand.
- `tests/dialog-store.test.js`: actualización de slices, altas y bajas de diálogos, estado de menú y caducidad del toast.
- Validaciones: `npm ci` (567 paquetes, 0 vulnerabilidades); arquitectura sin deuda nueva (64 excepciones baseline); ESLint; TypeScript; Vitest completo **405/405**; build correcto; E2E `tests/e2e/css-ui.spec.ts` **34/34** (Chromium/WebKit, incluye menú por teclado e interacción táctil). Build mantiene advertencias de chunks grandes `index` y `legacy-sync`.
- El primer intento de validar antes de instalar Zustand falló porque el manifiesto del worktree aún no contenía la dependencia; se corrigió instalándola y se repitieron satisfactoriamente todas las comprobaciones.

### Estado remoto de PRs anteriores

- PR #43 (iconos y hover táctil): abierta, base `main`, `MERGEABLE`; su check más reciente observado estaba `CANCELLED` (run `40462698638`), causa desconocida. El arreglo pasó las validaciones locales descritas en las secciones anteriores.
- PR #44 (slice Stats): abierta, base #43, `MERGEABLE`; check `40463179194` estaba `IN_PROGRESS` al validar este handoff.
- Crear PR #45 desde la rama actual sobre #44. Si #43/#44 se integran primero, reapuntar la PR y rama a `main`, resolver conflictos del handoff y reejecutar validaciones. No esperar a que el CI finalice, pero reconsultar el estado y corregir fallos reproducibles.

### Siguientes tareas de arquitectura — PENDIENTES

1. Reducir el contrato global de `StudyServices` por feature, empezando por la frontera de menor riesgo. Inventariar proveedores y consumidores; mover solo servicios con consumidores identificados; preservar hooks/API o migrarlos todos de forma atómica. Evitar una jerarquía de contextos que aumente complejidad.
2. Evaluar imports y dependencias de `core/application/legacy-engine.ts`; aislar únicamente una operación de persistencia/IO concreta en puerto/adaptador con pruebas de regresión. No cambiar reglas de estudio, eventos ni contratos.
3. Separar en `legacy-router.ts` composición, bootstrap y representación que aún sean necesarias; buscar referencias antes de borrar exports. Las páginas ya usan React Router, así que no rehacer rutas.
4. Revisar DTO/modelos legacy y centralizar mappers solo donde haya transformaciones duplicadas o una frontera externa real.
5. Añadir comprobación de ciclos y ejecutar gates globales. Retirar código solo con referencias y comportamiento verificados.

La próxima continuación debe empezar publicando #45 y leyendo el estado vivo de #43/#44; después, trabajar el punto 1 en otra rama/PR y seguir el orden. No tocar el cambio ajeno `tests/design-training.test.js` del checkout principal.

## Corrección de estado — 2026-10-27

Esta sección sustituye los estados de PR anteriores que quedaron obsoletos:

- `origin/main` está en `7e2cd29` e incluye PR #43, que ya está fusionada.
- PR #44 se fusionó accidentalmente en la rama `fix/menu-iconography-mobile-hover`; no se integró en `main`. PR #49 vuelve a publicar el cambio estadístico directamente contra `main`.
- PR #45 (Zustand) ya está rebasada localmente sobre `main` (`723b9bb`) y su base remota se cambió a `main`. Confirmar que GitHub refresca la mergeabilidad tras el cambio de base.
- PR #46 y #47 siguen abiertas y todavía necesitan ramas aplanadas y base `main`.
- PR #48 corrige el azul de los iconos del menú. Rama `fix/menu-icon-color`, directamente desde `main`; validación de color 4/4 (Chromium/WebKit, claro/oscuro), `npm run check` 402/402 y build correctos. Check remoto pendiente en la última consulta.
- Recuperación de sesión guardada: cambios locales en `/private/tmp/tai-architecture-run-recovery-port`, todavía basados en la antigua punta de #47. Extrae un caso de uso, su formato de dominio y el adaptador local; valida 39/39 pruebas focalizadas, `npm run check` 409/409, build y reanudación E2E 2/2. Antes de abrir PR hay que rebasar únicamente ese cambio contra `main`.
- En el worktree de #45, arquitectura, ESLint, ignore-growth y TypeScript pasan; build y `tests/e2e/css-ui.spec.ts` pasan (34/34). La suite Vitest falló de forma intermitente en `tests/app.test.js` durante el flujo de salida del test; ejecutada sola pasa. No se modificó esa prueba.
- Mantener intacto `tests/design-training.test.js` sin confirmar del checkout principal.

Siguiente paso: comprobar la mergeabilidad de #45; luego aplanar #46 y #47 sobre `main`, revisar sus diffs y validar antes de actualizarlas. Publicar después la recuperación de sesión como una PR independiente contra `main` y continuar el bootstrap restante, DTO/mappers y guardas de ciclos.

## Nueva tarea — carga inicial de Inicio (2026-10-27)

**IMPLEMENTADO EN PR #51, validación remota con una corrección nueva en curso.** Inicio mantiene un loading hasta que se cargan los datos y Firebase Auth resuelve; después presenta la vista de usuario o invitado. El primer check de CI reveló que, si el overview terminaba antes que Auth, `usePageReady` intentaba enfocar mientras el loading seguía montado. Se condicionó a `authResolved && (overview || error)`, y se añadió una aserción de foco al test de carga.

- PR #51: https://github.com/dramirodev/tai-oposicion/pull/51, base `main`, mergeable. Su check `40472313907` falló en E2E `react-pages.spec.ts` (Chromium y WebKit): el título de Inicio no recibía foco tras la carga asíncrona.
- La rama `feat/home-auth-loading` contiene el arreglo de foco. Validación local: test de Inicio 3/3, `npm run check` 413/413, build y E2E de Inicio 2/2 Chromium/WebKit. Actualizar la PR y volver a consultar su check sin esperar.

## Continuación de arquitectura — estado comprobado 2026-10-27

- PR #45 se integró en `main` (`7d4a5bc`).
- PR #46 volvió a entrar en conflicto al integrarse #47. Su rama se ha rebasado ahora sobre el `main` actualizado (`4c70512`); el conflicto local en `route-runtime.tsx` se resolvió conservando el nuevo runtime de #47 y la selección de servicios de #46. Validación local sobre esta base: `npm run check` 408/408, build y E2E de rutas 76/76. Pendiente publicar el head nuevo y confirmar el estado remoto.
- PR #47 ya está integrada en `main` (`4c70512`).
- PR #50 separa la recuperación de sesión guardada, apunta directamente a `main` y tiene validación local completa: 409/409 tests, build y E2E de reanudación 2/2. Validación remota aún pendiente.
- `.gitignore` ya contiene `/docs/` y `/reports/`. Se mantienen los archivos que ya están versionados; esas reglas ignoran contenido nuevo en esas carpetas.
- **Nueva tarea de publicación:** después de que cada PR llegue a `main`, actualizar el checkout desde el `main` remoto y ejecutar instalación reproducible, comprobaciones y build de producción en esa rama. Crear un tag anotado, único y apuntado al commit de `main` solo cuando compile y pasen las comprobaciones. No reutilizar tags ni cambiar `package.json` sin una decisión explícita sobre la numeración de versiones.
- El checkout principal permanece desactualizado y contiene un cambio local ajeno en `tests/design-training.test.js`; no tocarlo.

## Siguiente slice — mappers del banco HTTP (2026-10-27)

- Rama nueva directa desde `origin/main` `5a28985`: `refactor/question-bank-dto-boundary`, worktree `/private/tmp/tai-question-bank-boundary`.
- Se confirmó que `httpBankRepository` tiene consumidores reales en estrategia y exportación. `question-diagnostics.ts` y `bank-repository.ts` tenían bucles paralelos de mapping y conjuntos de avisos distintos.
- Se centralizó el mapping DTO→entidad en `mapQuestionDtos`; diagnósticos de campos desconocidos/registros inválidos comparten deduplicación. `diagnoseQuestionDtos` mantiene el modo de diagnóstico y retorna pronto en producción.
- No se tocaron el formato de preguntas, DTOs, almacenamiento ni consumidores legacy.
- Validación: pruebas focales mapper/diagnóstico/repository **9/9**; `npm run check` (arquitectura baseline 62, lint, ignore-growth, TypeScript, Vitest **414/414**), build y Playwright `stats-charts.spec.ts` **6/6** Chromium/WebKit.
- Documentación de arquitectura actualizada en `docs/architecture/migration-plan.md` y `migration-report.md`.
- Siguiente: abrir PR contra `main`; después revisar el checker de ciclos/imports y completar la lista de excepciones arquitectónicas eliminables con seguridad, sin mover todo mecánicamente.

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
- La PR #37 quedó cerrada sin merge; GitHub no permite reabrirla porque la rama fue recreada/forzada después de eliminarse su base. La integración Lucide fue republicada directamente contra `main`; el estado final y enlace vigente se registran en la última actualización.
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

## Estado de continuidad — actualización posterior

### PRs y ramas

- PR #34, #36 y #38 están integradas en `main`; la propuesta arquitectónica de #38 sigue pendiente de aprobación para iniciar la Etapa B/Zustand.
- PR #37 se cerró automáticamente al eliminarse la rama base después del merge de #36. GitHub rechazó reabrirla porque su head fue recreado/forzado. Se conservó su diff y se publicó directamente contra `main` en la nueva [PR #41](https://github.com/dramirodev/tai-oposicion/pull/41), rama `feat/lucide-iconography-main`.
- La integración Recharts está publicada en [PR #40](https://github.com/dramirodev/tai-oposicion/pull/40), rama `feat/recharts-study-visualizations`, base `main`.
- La migración de tests está publicada en la [PR #42](https://github.com/dramirodev/tai-oposicion/pull/42), rama `refactor/migrate-tests-to-rtl`, basada en `main`.

### React Testing Library y Jest

- Se añadieron `@testing-library/react`, `@testing-library/user-event` y `@testing-library/jest-dom` como dependencias de desarrollo. Vitest se mantiene: Jest duplicaría el runner y requeriría adaptar la configuración de Vite y los mocks `vi` sin aportar capacidades necesarias.
- Se migraron los 15 archivos que montaban componentes/hooks mediante `createRoot` a `render`, `screen`, consultas `within`, eventos RTL y `userEvent` donde corresponde. Se migró también el helper del proveedor de diálogos y se creó `renderApp` para componer `MemoryRouter` y `AppServicesProvider`.
- `tests/setup.js` configura matchers de `jest-dom` y limpieza RTL; `vitest.config.mjs` lo carga como `setupFiles`.
- Las pruebas de dominio, adaptadores y el puente legacy que no montan componentes React permanecen como pruebas Vitest. En `tests/app.test.js` se hizo explícita la espera del diálogo antes de comprobar su texto; así se quitó una condición de carrera reproducible al ejecutar la suite completa.
- Verificación focalizada de los 15 archivos migrados: 37/37 tests.
- `npm run check`: arquitectura sin deuda nueva (64 excepciones existentes), ESLint, ignore-growth, TypeScript y 402/402 tests en 89 archivos.
- `npm run build`: correcto. Se mantienen los avisos ya existentes por los bundles `index` (~523 kB) y `legacy-sync` (~549 kB).
- Revisión estructural: `rg` no encuentra `createRoot` ni `react-dom/client` bajo `tests`.

### Próximo paso

1. La PR #42 está abierta contra `main`; su estado remoto queda pendiente de revisión posterior, sin esperar sus pipelines.
2. Seguir con el estado de las PR #40 y #41 según las instrucciones del usuario.
3. Mantener la Etapa B de arquitectura/Zustand pendiente de aprobación explícita. Las pruebas E2E de navegador siguen en Playwright y no se migran a RTL.

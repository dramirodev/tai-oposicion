# Handoff — migración React, Shiki, auditoría CSS y arquitectura

Fecha: 2026-10-26 (Europe/Madrid)

## Rama y PR actuales

- Checkout activo: `/tmp/tai-migrate-cards-screen`
- Rama activa: `docs/architecture-audit-stack`, apilada sobre la punta publicada de `feat/migrate-cards-screen`.
- PR #34: [migrar pantallas restantes y modernizar presentación](https://github.com/dramirodev/tai-oposicion/pull/34), base `main`, abierta. HEAD `32796db`; el nuevo check `validate` del run `40378530457` estaba pendiente al actualizar este documento. No se esperó a CI.
- El run anterior `40373734672` falló solo en 68 comparaciones visuales Linux; el baseline quedó actualizado en `32796db` y el flujo completo pasó localmente en macOS.
- No cambiar al checkout `/Volumes/SSD/develop/PWA_TAI`; está obsoleto para este trabajo.
- `node_modules` se reinstaló localmente en este checkout para añadir Shiki; no versionarlo.

## Orden recomendado de trabajo pendiente

1. **Cerrar PR #34:** revisar el resultado del nuevo check remoto tras el cambio de baseline; el flujo local pasó en macOS, pero solo GitHub puede confirmar el entorno Linux. El usuario fusiona cuando el check quede verde.
2. **Triage de React Doctor en las páginas migradas:** confirmar los 17 diagnósticos observados; resolver primero problemas reales que puedan confundir o bloquear a usuarios (accesibilidad/teclado), después rendimiento/mantenibilidad. No cambiar el falso positivo de `#app`: el destino existe en `index.html`.
3. **Terminar Lucide React + Taste:** completar la revisión visual de Progreso, Ajustes y pantallas de práctica; sustituir solo iconos de interfaz restantes, revisar teclado/temas y capturas. Abrir PR propia contra `main` después del merge de #34.
4. **Arquitectura Etapa A:** conservar `docs/architecture-audit-stack` basada en la punta de #34; después del merge, actualizar/reapuntar la rama a `main`, completar la auditoría solo documental, abrir PR contra `main` y esperar aprobación antes de Etapa B.
5. **Recharts:** con la arquitectura objetivo definida, auditar los gráficos y datos reales; migrar solo visualizaciones donde aporte valor, en PR independiente.
6. **Etapa B y Zustand:** solo tras aprobación de la propuesta; migrar módulos gradualmente y añadir Zustand únicamente si el análisis muestra estado compartido de cliente que lo necesita.

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

## Nueva tarea de arquitectura: rama apilada sobre PR #34

El usuario pidió una auditoría completa del proyecto y definió Etapa A y Etapa B. Tras completar el trabajo actual:

- La rama `docs/architecture-audit-stack` ya está publicada y parte del HEAD de PR #34 (`32796db`). Mientras #34 siga abierta, mantener este stack separado; tras el merge, actualizarlo/reapuntarlo a `main` y entonces crear la PR de arquitectura con base `main`.
- Inspeccionar todo el repositorio antes de modificar código.
- En Etapa A no cambiar código de producción. Documentar `docs/architecture/audit.md`, `target-architecture.md`, `dependency-rules.md`, `migration-plan.md` y `migration-report.md` con arquitectura real, reglas, diagrama, funcionalidades/casos de uso reales, riesgos y prioridades.
- Abrir PR contra `main` cuando la propuesta esté concreta. Presentarla al usuario y esperar su aprobación antes de Etapa B.
- En Etapa B, migración funcional gradual con tests y gates; sin cambiar contratos persistidos, seguridad, rutas públicas, UI o comportamiento sin necesidad.

## Pasos inmediatos al retomar

1. El resultado final de `npx playwright test --update-snapshots` es 154/154 aprobado; la prueba regeneró capturas en claro/oscuro y Chromium/WebKit tras inspección visual de Inicio.
2. Taste posterior a Lucide: Inicio a 1440/768/390 revisado, overflow y errores de consola 0; el único warning fue `below-fold` explicado. Ampliar a Progreso, Ajustes y pantallas de práctica si se reanuda la tarea de iconos. Eliminar `.taste-skill/` local antes de versionar.
3. Revisar el estado remoto del run `40378530457` sin dejar el hilo esperando. Si falla por una razón distinta, leer ese job y corregirla.
4. Tras el merge de #34, ejecutar el orden recomendado de arriba. La rama stack está alineada al HEAD `32796db`; actualizarla a `main` antes de completar la Etapa A y abrir su PR.
## Nota de continuidad

El observador de `claude-mem` informó que su cuota semanal está agotada: “Claude rejected the request because its weekly usage allowance is exhausted.” No reiniciar el worker. Este documento y el work state `continuar-migracion-shiki-css` conservan la continuidad.

## Actualización de continuidad — arquitectura Etapa A

Corte 2026-10-26: se completó el análisis documental en `/tmp/tai-architecture-audit`, rama `docs/architecture-audit-stack`, todavía apilada sobre `feat/migrate-cards-screen` (`32796db`). Las PR #34, #36 y #37 permanecen abiertas; #36 está apilada en #34 y #37 en #36. La auditoría y los cinco documentos de `docs/architecture/` ya están preparados en la rama; no hay cambios de producción ni se ha iniciado Zustand.

La inspección confirmó que `legacyPaths` está vacío y las páginas públicas tienen rutas lazy. `App.tsx` todavía consume `studyServices` y arranca `bootLegacy` desde `legacy-router.ts`; `core/application/legacy-engine.ts` sigue dependiendo de tres módulos de adapters/legacy. `npm run check:architecture` pasó con 64 hallazgos baseline y cero deuda nueva. Estos documentos deben revisarse contra `main` actualizado después del merge de #34 antes de implementar.

Orden propuesto actualizado:

1. Publicar y revisar la PR documental de arquitectura apilada sobre #34; esperar aprobación explícita antes de Etapa B.
2. Una vez integrada #34, reorientar el stack a `main`, reconciliar la propuesta y empezar con un slice de Progreso/estadísticas de solo lectura.
3. Reducir el contrato global de servicios por feature y evaluar Zustand solo para una rebanada efímera realmente compartida; no mover estado local ni datos persistidos.
4. Desacoplar `legacy-engine.ts` con puertos/adaptadores probados; luego separar composición/arranque y retirar código HTML legacy tras búsqueda de referencias.
5. Cerrar mappers/tipos antiguos, añadir control de ciclos y repetir las validaciones; realizar las tareas independientes de Recharts/Lucide según sus PRs y el handoff UI.

**Etapa A terminada en código y documentos; falta publicar la PR de propuesta. Etapa B pendiente de aprobación.** Archivos de propuesta: `docs/architecture/audit.md`, `target-architecture.md`, `dependency-rules.md`, `migration-plan.md`, `migration-report.md`.

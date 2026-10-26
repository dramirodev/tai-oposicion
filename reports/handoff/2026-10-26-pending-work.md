# Handoff — migración React, Shiki, auditoría CSS y arquitectura

Fecha: 2026-10-26 (Europe/Madrid)

## Rama y PR actuales

- Checkout activo: `/tmp/tai-migrate-cards-screen`
- Rama: `feat/migrate-cards-screen`
- PR que se está ampliando: [#34](https://github.com/dramirodev/tai-oposicion/pull/34), contra `main`.
- Último commit: `36fcd90 docs: add handoff for migration and audit work` (local; los cambios siguientes siguen sin commit/push).
- La rama está 2 commits por delante del remoto. No cambiar al checkout `/Volumes/SSD/develop/PWA_TAI`; está obsoleto para este trabajo.
- `node_modules` se reinstaló localmente en este checkout para añadir Shiki; no versionarlo.

## Orden de trabajo pendiente (estado al pausar)

1. **PR #34 — migración React, Shiki y auditoría CSS:** commit `8971436` publicado en `feat/migrate-cards-screen`; PR #34 actualizada con alcance y validación local. `npm run check` pasó (89 archivos, 402 tests), `npm run build` pasó con avisos de chunks grandes ya conocidos y `npx playwright test --update-snapshots` pasó (154 casos) en Chromium/WebKit. No se esperó a CI.
2. **Lucide React:** integración parcial incluida en el mismo stack porque sustituye iconos de las rutas React que aporta PR #34. Instalado `lucide-react`; sustituidos SVG de la navegación, Inicio, enlaces de ayuda y Detective. Taste final de Inicio a 1440/768/390: sin overflow, sin errores de consola, una advertencia defendida `below-fold` (3 de 7 bloques en el primer viewport de escritorio; hay contenido operativo real debajo). Falta ampliar la pasada a otras pantallas y decidir los emojis semánticos restantes. No crear una PR contra `main` que dependa de páginas aún no presentes allí.
3. **Etapa A de arquitectura:** pendiente y sin cambios de producción. El usuario pide prepararla como stack sobre la rama de PR #34; crear una rama de trabajo desde su HEAD publicado, con su futura PR apuntando inicialmente a `feat/migrate-cards-screen`. Tras fusionar #34, actualizar esa rama contra `main` y cambiar la base de la PR a `main`. Etapa B requiere aprobación explícita de la propuesta.
4. **Recharts:** tarea autorizada previamente, pendiente. Auditar datos y gráficos reales; migrar solo los componentes con una mejora clara, en una PR compatible con el stack de arquitectura.
5. **Zustand:** queda en Etapa B, después de que el usuario apruebe Etapa A. Usarlo solo para estado compartido de cliente que lo necesite.

## Estado de migración

Migradas previamente a React y presentes en PR #34: Tarjetas, Falladas, Relámpago, Detective de trampas y Lectura atenta. Ajustes se migró a `SettingsPage.tsx`, ruta lazy, servicio tipado y previsualización/importación segura de copias; se eliminó `src/features/settings/legacy.ts`. En esta continuación se migraron `/test`, `/sim`, `/sim2`, `/quiz`, `/result` y `/stats` a páginas React lazy; `/examenes` quedó como redirección React. Se retiraron los renderizadores y entradas `legacyPaths` ya sustituidos.

La comprobación de arquitectura actual dio `sin deuda nueva; 64 excepciones pendientes`.

`/quiz` conserva respuesta, ayudas, subrayado, confianza, revisión y tiempo; `/result` conserva revisión y estrategia; `/stats` mantiene los datos y métricas existentes. Se eliminó `src/features/stats/legacy.ts` y el renderizador de evolución ya sustituido. Rutas pendientes de migrar: ninguna identificada en la lista actual.

## Trabajo sin commit

- `src/features/failures/FailuresPage.tsx`: añadida marca `data-reviewed` para que las pruebas comprueben persistencia desde la nueva vista React.
- Migración de Test/Simulacros: `src/features/test/TestPage.tsx`, `src/features/test/test-controller.ts`, `src/features/simulation/SimulationPage.tsx`, `src/features/simulation/SimulationReviewPage.tsx`, `src/app/ExamsRedirect.tsx` y servicios/rutas asociados.
- Nuevas páginas y composición: `src/features/quiz/QuizPage.tsx`, `src/app/quiz-composition.ts`, `src/features/result/ResultPage.tsx`, `src/features/stats/StatsPage.tsx`, `src/app/stats-composition.ts`.
- Shiki: `src/shared/ui/StudyCode.tsx`, integración en `StudyMarkup.tsx`, estilos en `home.css` y `question.css`, dependencia en `package.json`/lockfile y prueba en `tests/study-markup.test.js`.
- Hay además actualizaciones a pruebas unitarias, E2E y snapshots de rutas en Chromium/WebKit y tema claro/oscuro.
- Los cambios siguen sin commit.


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

Aún no se ha iniciado la auditoría CSS. Al empezar, inventariar todos los CSS y estilos de componentes; buscar duplicados, especificidad, `!important`, px con conversión deliberada a rem, tokens, responsive 320/375/430/768/1024/1280/1440/1920, zoom, temas claro/oscuro, foco, contraste, objetivos táctiles y `prefers-reduced-motion`. Ejecutar Stylelint si está configurado, ESLint, TypeScript, tests existentes y build. Inspeccionar visualmente todas las rutas con navegador disponible; corregir fallos y repetir el ciclo. No cambiar lógica de negocio, funcionalidades ni identidad visual.

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

## Nueva tarea de arquitectura tras cerrar las anteriores

El usuario pidió una auditoría completa del proyecto y definió Etapa A y Etapa B. Tras completar el trabajo actual:

- Crear una rama nueva basada en `main` actualizado.
- Inspeccionar todo el repositorio antes de modificar código.
- En Etapa A no cambiar código de producción. Documentar `docs/architecture/audit.md`, `target-architecture.md`, `dependency-rules.md`, `migration-plan.md` y `migration-report.md` con arquitectura real, reglas, diagrama, funcionalidades/casos de uso reales, riesgos y prioridades.
- Abrir PR contra `main` cuando la propuesta esté concreta. Presentarla al usuario y esperar su aprobación antes de Etapa B.
- En Etapa B, migración funcional gradual con tests y gates; sin cambiar contratos persistidos, seguridad, rutas públicas, UI o comportamiento sin necesidad.

## Pasos inmediatos al retomar

1. El resultado final de `npx playwright test --update-snapshots` es 154/154 aprobado; la prueba regeneró capturas en claro/oscuro y Chromium/WebKit tras inspección visual de Inicio.
2. Taste posterior a Lucide: Inicio a 1440/768/390 revisado, overflow y errores de consola 0; el único warning fue `below-fold` explicado. Ampliar a Progreso, Ajustes y pantallas de práctica si se reanuda la tarea de iconos. Eliminar `.taste-skill/` local antes de versionar.
3. Commit `8971436` y `git push origin feat/migrate-cards-screen` completados; título y descripción de PR #34 actualizados. No fusionar ni esperar CI, según preferencia del usuario.
4. El usuario pidió pausar y apilar la migración de arquitectura sobre PR #34. Crear la rama local `docs/architecture-audit-stack` desde la punta publicada de #34; cuando se redacte la propuesta documental, publicar una PR cuya base sea `feat/migrate-cards-screen`. Después de fusionar #34, actualizar la rama contra `main` y cambiar la base de la PR a `main`. Auditoría solo documental, sin cambios de producción; Etapa B espera aprobación.
5. Auditar e integrar Recharts cuando el usuario reanude, documentando decisiones en este handoff.
6. En Etapa B, analizar e implementar Zustand solo para estado compartido de cliente que lo necesite, con selectores y pruebas; no trasladar estado local/remoto ni lógica de negocio automáticamente.
## Nota de continuidad

El observador de `claude-mem` informó que su cuota semanal está agotada: “Claude rejected the request because its weekly usage allowance is exhausted.” No reiniciar el worker. Este documento y el work state `continuar-migracion-shiki-css` conservan la continuidad.

# Handoff — migración React, Shiki, auditoría CSS y arquitectura

Fecha: 2026-10-26 (Europe/Madrid)

## Rama y PR actuales

- Checkout activo: `/tmp/tai-migrate-cards-screen`
- Rama: `feat/migrate-cards-screen`
- PR que se está ampliando: [#34](https://github.com/dramirodev/tai-oposicion/pull/34), contra `main`.
- Último commit: `b66424d refactor(settings): migrate legacy settings screen to React` (local; aún no se ha publicado después de este commit).
- La rama está 1 commit por delante del remoto. No cambiar al checkout `/Volumes/SSD/develop/PWA_TAI`; está obsoleto para este trabajo.
- Existe un enlace local no versionado `node_modules -> /Volumes/SSD/develop/PWA_TAI/node_modules`; quitarlo antes de publicar/entregar.

## Orden de trabajo pendiente

1. Terminar la migración de todas las rutas legacy restantes en la misma PR #34.
2. Instalar e integrar Shiki, con un highlighter compartido para bloques de código y estilos que respeten los temas claro y oscuro actuales.
3. Completar la auditoría CSS/responsive/accesibilidad pedida por el usuario, corrigiendo problemas y repitiendo audit→fix→validate hasta que no queden defectos solucionables.
4. Cuando lo anterior esté terminado, empezar la auditoría arquitectónica en una rama nueva. La Etapa A solicitada es solo auditoría y propuesta; preparar diagnóstico, estructura objetivo, diagrama, plan, riesgos y complejidad, abrir PR contra `main` y esperar aprobación antes de implementar Etapa B.

## Estado de migración

Migradas previamente a React y presentes en PR #34: Tarjetas, Falladas, Relámpago, Detective de trampas y Lectura atenta. La ruta Ajustes acaba de migrarse a `SettingsPage.tsx`, lazy route, servicio tipado y previsualización/importación segura de copias. Se eliminó `src/features/settings/legacy.ts`. La pantalla conserva sincronización/cuenta, preferencias, fecha, modo desarrollador, descargas offline, Anki, exportación/importación, historial IA, borrado y diagnóstico.

La comprobación de arquitectura dio `sin deuda nueva; 80 excepciones pendientes`; TypeScript y ESLint enfocado pasaron antes de los últimos cambios de tests.

Rutas todavía legacy en `legacyPaths`: `/quiz`, `/result`, `/test`, `/sim`, `/sim2`, `/examenes` y `/stats`. `src/features/stats/legacy.ts` aún registra Estadísticas. Hay que retirar esas páginas de `legacyPaths`, añadirlas lazy a React Router, eliminar renderizadores legacy cuando cada pantalla haya sido reemplazada y finalmente retirar `LegacyRoute`/`legacy-router` al resolver la composición que aún se necesite.

## Trabajo sin commit

- `src/features/failures/FailuresPage.tsx`: añadida marca `data-reviewed` para que las pruebas comprueben persistencia desde la nueva vista React.
- `tests/app.test.js`, `tests/design-flow.test.js`: selectores ajustados a la UI React de Falladas y al filtro instantáneo.
- `tests/design-settings.test.js`: pruebas del renderizador antiguo sustituidas por una prueba de preview vía servicio y se conserva cobertura offline.
- `tests/settings-page.test.js`: cobertura nueva de controles, importación y cambio de cuenta durante confirmación.
- `tests/design-training.test.js`: se empezó a migrar las pruebas legacy a integración de las páginas React.
- Estos cambios no están validados ni committeados en conjunto. No ocultar fallos ni borrar cobertura para hacer verde la suite.

## Últimas validaciones y fallos observados

- `npm run typecheck`: pasó tras migrar Ajustes.
- ESLint enfocado: pasó en la pantalla, servicios y rutas; el intento anterior también detectó y se corrigieron importaciones de capa y un `any`.
- `npm run check:architecture`: pasó (`sin deuda nueva; 80 excepciones pendientes`).
- `npm run build`: pasó antes de los últimos cambios de tests; Vite avisó que dos chunks superan 500 kB.
- Suite completa antes de actualizar tests legacy: 378 pasaron y 2 fallaron por importar `features/settings/legacy.js` y `features/trainers/legacy.js`, eliminados en migraciones anteriores; además, había tests DOM obsoletos de Falladas. Se adaptaron pruebas, no se desactivaron.
- Ejecución focalizada de Settings/Falladas: pasó (25 tests en cuatro archivos).
- `tests/design-training.test.js` reescrito parcialmente: Relámpago y Detective pasan. La prueba Lectura se queda en “Preparando preguntas…” con su fixture actual. Investigar el origen de datos offline/`getSup()`/`byIds()` del fixture o usar el servicio/composición de prueba real; luego comprobar selección por teclado y transición de pasos.
- React Doctor, durante el hook del commit `b66424d`, detectó complejidad alta en `SettingsPage.tsx` y avisos `js-set-map-lookups` en `legacy-router.ts` (líneas aproximadas 245, 624 y 748). Leer el código y dividir la presentación de Ajustes; determinar si los lookups del router son verdaderos positivos y reducirlos sin alterar la lógica.
- No se ejecutó E2E/navegador en este tramo.

## Shiki ya investigado

Context7 resolvió `/shikijs/shiki` y se consultó la guía de `createHighlighter`, idiomas/temas singleton y salida de temas claro/oscuro mediante CSS variables. Falta instalar, configurar e integrar. Punto de integración candidato: `src/shared/ui/StudyMarkup.tsx`, que traduce el formato HTML interno y puede delegar los nodos `<code>` a un componente React asíncrono con highlighter singleton. Confirmar cómo se selecciona el tema actual antes de fijar CSS.

## Auditoría CSS solicitada

Skills disponibles y localizadas:
- `/Users/dramiro/.agents/skills/design-taste-frontend/SKILL.md` — leído; para pantallas de aplicación leer `references/app-screens.md` completo y usar inspección visual/loop de capturas.
- `/Users/dramiro/.agents/skills/web-design-guidelines/SKILL.md` — leído; se obtuvieron las reglas actuales desde `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`.

Aún no se ha iniciado la auditoría CSS. Al empezar, inventariar todos los CSS y estilos de componentes; buscar duplicados, especificidad, `!important`, px con conversión deliberada a rem, tokens, responsive 320/375/430/768/1024/1280/1440/1920, zoom, temas claro/oscuro, foco, contraste, objetivos táctiles y `prefers-reduced-motion`. Ejecutar Stylelint si está configurado, ESLint, TypeScript, tests existentes y build. Inspeccionar visualmente todas las rutas con navegador disponible; corregir fallos y repetir el ciclo. No cambiar lógica de negocio, funcionalidades ni identidad visual.

## Nueva tarea de arquitectura tras cerrar las anteriores

El usuario pidió una auditoría completa del proyecto y definió Etapa A y Etapa B. Tras completar el trabajo actual:

- Crear una rama nueva basada en `main` actualizado.
- Inspeccionar todo el repositorio antes de modificar código.
- En Etapa A no cambiar código de producción. Documentar `docs/architecture/audit.md`, `target-architecture.md`, `dependency-rules.md`, `migration-plan.md` y `migration-report.md` con arquitectura real, reglas, diagrama, funcionalidades/casos de uso reales, riesgos y prioridades.
- Abrir PR contra `main` cuando la propuesta esté concreta. Presentarla al usuario y esperar su aprobación antes de Etapa B.
- En Etapa B, migración funcional gradual con tests y gates; sin cambiar contratos persistidos, seguridad, rutas públicas, UI o comportamiento sin necesidad.

## Pasos inmediatos al retomar

1. Leer este handoff y comprobar `git status --short --branch` en `/tmp/tai-migrate-cards-screen`.
2. Retomar y reparar `tests/design-training.test.js` (Lectura queda cargando); ejecutar pruebas focalizadas.
3. Corregir complejidad de `SettingsPage` y revisar los tres avisos de lookup; volver a ejecutar `npm run typecheck`, ESLint y arquitectura.
4. Terminar rutas legacy y pruebas equivalentes React; retirar el puente legacy solo después de migrar sus consumidores y su lifecycle.
5. Completar validaciones locales, revisar React Doctor/build/tamaño de chunks y E2E/browser; actualizar este handoff, commitear y publicar los cambios restantes a PR #34 contra `main` sin fusionar.
6. Integrar Shiki según la guía ya consultada.
7. Ejecutar y corregir la auditoría CSS completa.
8. Solo después, iniciar Etapa A de la auditoría arquitectónica en la rama nueva y esperar aprobación para implementar.

## Nota de continuidad

El observador de `claude-mem` informó que su cuota semanal está agotada: “Claude rejected the request because its weekly usage allowance is exhausted.” No reiniciar el worker. Este documento y el work state `continuar-migracion-shiki-css` conservan la continuidad.

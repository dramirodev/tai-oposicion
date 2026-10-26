# Auditoría arquitectónica de TAI

Fecha de corte: 2026-10-26. Rama analizada: `docs/architecture-audit-stack`, actualizada sobre `main` en `095a0e1` después del merge de PR #34. La auditoría describe ese código y debe revalidarse si `main` cambia antes de Etapa B.

## Resumen

TAI ya tiene una base real de arquitectura por capas: `core/domain`, `core/application`, `core/ports`, `adapters`, `app`, `features` y `shared`. El dominio está separado de React/Firebase, hay puertos para varias operaciones y casi todas las pantallas se cargan mediante rutas React lazy. No conviene reemplazar esta estructura por una reorganización masiva.

El límite más importante que se incumple está en `src/core/application/legacy-engine.ts`: importa directamente `adapters/local/legacy-store.ts`, `adapters/http/legacy-data.ts` y `adapters/legacy/types.ts`. Así, el motor que coordina sesiones de estudio conoce las implementaciones de persistencia y consulta. La otra concentración está en `src/app/legacy-router.ts` (942 líneas): además de arranque y composición, crea servicios de muchas funcionalidades y conserva renderizadores imperativos, manipulación HTML, acceso al store y coordinación de flujos.

La migración de páginas no equivale a retirar toda la lógica legacy. A la fecha de corte, `src/shared/navigation/paths.ts` declara `legacyPaths = []`, por lo que React Router no envía rutas a `LegacyRoute`; sin embargo `App.tsx` aún importa `legacy-router.ts` para inicializar el motor y obtener `studyServices`, y `legacy-router.ts` sigue exportando `renderLegacy`. Es una dependencia heredada de composición y arranque, no una ruta pública activa identificada.

## Estructura y responsabilidades observadas

| Área | Responsabilidad actual | Evaluación |
|---|---|---|
| `core/domain` | Reglas puras de selección, puntuación, repetición espaciada, analítica, trampas, lectura, intentos y explicaciones | Buena independencia; conservar como núcleo compartido mientras los modelos sean usados por varias funciones. |
| `core/application` | Casos de uso de intentos, exportación, explicaciones y recuperación; también contiene `legacy-engine.ts` | Los casos nuevos usan puertos. El motor heredado rompe la dirección de dependencia. |
| `core/ports` | Contratos para repositorios, sincronización, acceso, reloj, caché y seguimiento de intentos | Base útil, pero varios contratos aún no cubren las necesidades del motor principal. |
| `adapters` | Firebase, HTTP, IndexedDB/store local, caché offline, DTO y mappers | Frontera externa reconocible. Adaptadores legacy aún cooperan mediante `legacy-store`, tipos heredados y fachadas. |
| `app` | Arranque, router, rutas, composición y coordinadores de servicios | Responsabilidad válida, concentrada en `legacy-router.ts` y varios archivos de composición. |
| `features` | Páginas React por área de producto, controladores y transformaciones de presentación | Estructura por funcionalidad ya existe. Algunos servicios aún se declaran centralmente y se inyectan como un objeto global. |
| `shared` | UI común, presentación, estilos, diálogos y servicios/contexto | Reutilizable, aunque `study-services.tsx` concentra contratos de todas las páginas y puede convertirse en un contenedor global difícil de mantener. |

Inventario de alto nivel: 14 carpetas feature, 19 destinos de ruta canónica, 29 archivos en `core`, 10 puertos y 3.198 líneas bajo `adapters`. Las cifras son descriptivas del checkout; no son objetivos de tamaño.

## React, estado y datos

- `src/app/route-runtime.tsx` crea un `createHashRouter`, declara rutas canónicas y carga páginas con `React.lazy`/`Suspense`. Los paths se centralizan en `src/shared/navigation/paths.ts`; `src/app/paths.ts` los reexporta. La pantalla de exámenes redirige mediante React.
- Las páginas consumen servicios tipados de `useStudyServices()` y mantienen estado local con `useState` para pestañas, filtros, formularios, mensajes y carga. No se encontró evidencia de Zustand instalado ni de stores Zustand.
- `src/shared/ui/study-services.tsx` define contratos para 19 funcionalidades y un único `StudyServices` con los 19 grupos. Esto evita importar Firebase desde cada pantalla, pero hace que el contrato compartido y el proveedor crezcan con cada feature.
- El estado de diálogos/toasts usa un pequeño `DialogStateStore` observable propio en `src/shared/ui/dialog-store.ts`; el estado de sesión/progreso se coordina en el store local legacy. Son necesidades diferentes: UI transitoria, datos persistidos y sesión activa no se deben migrar juntos a Zustand.
- Firebase solo aparece en adaptadores. Accesos web a `fetch`, `localStorage` y `IndexedDB` se concentran principalmente en adaptadores, pero hay excepciones heredadas en `app` y `core/application/legacy-engine.ts`.
- Hay DTO y mappers explícitos para preguntas, acceso, intentos, sesiones, estadísticas y explicaciones. Sin embargo `adapters/legacy/types.ts` aún suministra tipos de transporte/persistencia usados por capas superiores.
- `StatsPage` y otras páginas representan los límites actuales: UI solicita datos a servicios, pero composición y transformación de estadísticas siguen mezcladas en `app/stats-composition.ts`, `features/stats/analytics-mapper.ts` y dominio. Es una oportunidad adecuada para una primera migración funcional de solo lectura.

## Deuda de límites medida

`npm run check:architecture` se ejecutó en esta rama y pasó: **64 hallazgos conocidos en la línea base, sin deuda nueva**. La herramienta cuenta módulos/imports legacy, escrituras HTML y dependencias de capa; esto no significa que existan 64 defectos funcionales. La inspección de AST en el checkout actual identificó 3 importaciones prohibidas desde `core/application/legacy-engine.ts` hacia adaptadores; el resto de las fronteras de capa detectadas ya figura en la línea base.

La línea base es una protección contra regresiones, no una auditoría de calidad completa: no sustituye la revisión de dependencias circulares, acceso a datos ni contratos públicos. No se afirmó que exista un ciclo; la comprobación de ciclos queda pendiente de añadir o ejecutar en la etapa de implementación.

## Flujos reales candidatos a casos de uso

Se encontraron operaciones existentes para:

1. Crear/reanudar una sesión de práctica o simulacro, responder, marcar pendiente/consulta, revelar solución, puntuar y cerrar la sesión.
2. Registrar intentos y eventos detallados, sincronizarlos por cuenta y consultar evolución/estrategia.
3. Seleccionar preguntas nuevas, de repaso, falladas, lentas o asociadas a trampas.
4. Planificar y calificar tarjetas de repetición espaciada.
5. Leer progreso agregado, comparar simulacros y filtrar evolución.
6. Importar/exportar copias, recuperar cuenta y borrar historial detallado.
7. Administrar acceso mediante autenticación y solicitudes.
8. Descargar datos para uso offline y detectar/aplicar una actualización.
9. Ejecutar los entrenadores de lectura, trampas y relámpago.

No se proponen funciones nuevas. La lógica de scoring, selección, repetición, análisis y transiciones de intento ya tiene implementaciones de dominio que deben reutilizarse y cubrirse con pruebas antes de cambiar sus adaptadores.

## Riesgos de regresión

- Persistencia antigua: claves de `localStorage`, esquema de IndexedDB, formatos de progreso, sesiones y copias deben conservarse o tener migraciones explícitas.
- Aislamiento de cuentas: cambios de cuenta mientras una promesa está pendiente no deben mezclar ni publicar progreso de dos usuarios.
- Offline/PWA: banco descargado, caché, service worker y recuperación de sesiones deben seguir funcionando sin red.
- Sincronización Firebase: mantener IDs, DTO, orden/cursor, tombstones y contratos de Firestore; las reglas de seguridad y los esquemas quedan fuera de alcance.
- URLs hash: mantener rutas visibles y deep links; no cambiar la forma de navegación pública sin razón.
- Evaluación de preguntas: conservar estados distintos de respuesta, “No lo sé” y “Ver solución”, puntuación y datos históricos.
- Puente legado: retirar un renderizador o módulo solo tras buscar consumidores y probar los flujos que lo usaban.

## Prioridades

| Prioridad | Problema | Complejidad | Impacto si se pospone |
|---|---|---:|---|
| P0 | `legacy-engine` importa adaptadores y tipos de transporte | Alta | La regla central de dependencias no se cumple y dificulta pruebas aisladas. |
| P1 | `legacy-router` concentra composición, arranque, servicios y renderizado HTML | Alta | Cambios de una función pueden afectar rutas y flujos ajenos; la migración queda incompleta pese a páginas React. |
| P1 | `StudyServices` es un contrato monolítico global | Media | Acoplamiento entre features y ruido de suscripción/proveedor; no es un fallo funcional actual. |
| P2 | Contratos de repositorio incompletos y tipos legacy atravesando capas | Media/alta | Mapper/persistencia difícil de reemplazar y pruebas con fixtures complejas. |
| P2 | Estado compartido sin una política explícita para UI, dominio y persistencia | Media | Puede inducir a mover estado local o persistido a un store global sin necesidad. |
| P3 | Falta evidencia automatizada específica contra ciclos | Baja/media | Un nuevo ciclo podría pasar las verificaciones actuales si respeta las reglas existentes. |

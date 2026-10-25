# Arquitectura de Preparación TAI

## Estado real de la migración

La estructura de carpetas refleja el destino (`core`, `adapters`, `features`, `shared`, `app`), pero los límites aún no están cerrados. Las pantallas siguen en `features/*/legacy.ts` y `app/legacy-router.ts`. `core/application/legacy-engine.ts` todavía importa directamente el store y el banco heredados y usa `legacy/logic.ts`; por tanto, no es aún un caso de uso aislado por puertos. El store, el banco HTTP, Firebase, offline y `legacy-dom` conservan su API compacta actual para que el puente mantenga el comportamiento.

El prototipo paralelo de sesiones fue retirado en `9540f8e`; el motor de referencia sigue siendo `core/application/legacy-engine.ts`, `legacy/logic.ts` y `adapters/local/legacy-store.ts`. Las reglas puras de selección (`selection.ts`), puntuación (`scoring.ts`), análisis (`simulation-analysis.ts`), repaso espaciado (`spaced-repetition.ts`) y trampas (`traps.ts`) ya se extraen en `core/domain`. `legacy/logic.ts` conserva wrappers para los formatos compactos que consumen el motor y las pantallas heredadas. Formato HTML, escape y tiempo están en `shared/presentation/study-text.ts` y `format.ts`.

Estas extracciones se comparan con las pruebas heredadas; no cambian selección, puntuación, calendario, serialización ni ritmo. Quedan reglas de dominio en `legacy/logic.ts` y en el adaptador del banco por extraer. El estado `run` todavía tiene lectores heredados; la composición React usa suscripciones para determinar la sección activa, pero no se ha completado la encapsulación del motor.

## Capas objetivo

- `core/domain`: entidades y reglas deterministas, sin IO, React, DOM, fechas del sistema, DTO ni HTML.
- `core/application`: acciones de usuario que coordinan reglas y puertos, con estado observable por `subscribe()` y `getSnapshot()`.
- `core/ports`: contratos en modelos de dominio para progreso, sesiones, banco, sincronización, acceso, offline, reloj y azar.
- `adapters`: IO y traducción DTO ↔ dominio; los formatos locales, IndexedDB y Firestore se preservan literalmente.
- `features/<feature>`: `components`, `hooks`, `view-models`, `mappers` e `index.ts` público. Hoy cada pantalla aún usa `legacy.ts`.
- `shared`: UI genérica, hooks de suscripción y formato de presentación.
- `app`: composición explícita, router, providers y ciclo de vida.

## Modelos y mappers

**DTO:** el banco externo usa `{ i, t, o, q, a, c, ... }`; `tai.v1` guarda arrays posicionales y claves compactas. No se renombra lo que se persiste ni lo que se envía a Firestore.

**Dominio:** `Question` usa `{ id, topicId, origin, statement, options, correctIndex }`; `QuestionStats` usa `attempts`, `correct`, `lastSeenAt` y propiedades nombradas.

**View model:** la futura `QuestionCardVM` tendrá etiquetas, HTML y estado de opciones listos para pintar. Aún no hay view models conectados al puente.

Los DTO se definen en `adapters/*/dto`; los mappers DTO ↔ dominio en `adapters/*/mappers`; los mappers dominio → view model en `features/<feature>/mappers`. Texto escapado, HTML, fechas y formatos visuales van en `shared/presentation`. Los `toDomain` devuelven resultado explícito y conservan `TODO(zod)` para la fase de esquemas.

## Reglas y excepciones de lint

`npm run lint` usa ESLint flat config, `eslint-plugin-import` (`import/no-restricted-paths`), TypeScript ESLint y `eslint-plugin-react-hooks`. Restringe imports por capa, APIs del navegador, fechas del sistema y `Math.random()` en dominio; prohíbe `dangerouslySetInnerHTML`. Los alias están configurados en TypeScript y Vite: `@core`, `@adapters`, `@features`, `@shared`, `@app`; los imports existentes todavía no se han convertido todos.

La lista de exclusiones vigente es el bloque `ignores` de `eslint.config.mjs`: `src/core/application/legacy-*.ts`; `src/adapters/legacy/**`; `src/adapters/local/config.ts`; `src/adapters/offline/cache.ts`; `src/legacy/**`; `src/features/**/legacy.ts`; `src/shared/ui/legacy-dom.ts`; `src/adapters/firebase/legacy-sync.ts`; `src/adapters/http/legacy-data.ts`; `src/adapters/local/legacy-store.ts`; `src/adapters/firebase/sync-facade.ts`; `src/shared/presentation/legacy-study.ts` (excepción obsoleta pendiente de limpiar); `src/app/legacy-router.ts`. Se retiran una a una cuando pasan las reglas. El ciclo del motor legado y el estado de sync aún cruza capas; `core`, `adapters` y `shared` no están todos fuera de las exclusiones.

## Añadir una feature

1. Define entidades y reglas puras; inyecta reloj y azar. Añade un caso de uso por acción y un puerto por necesidad de IO.
2. Implementa el puerto en `adapters`; traduce DTO con mappers puros y prueba ida/vuelta persistida.
3. Añade view model, mapper de presentación, hook y componente en `features/<nombre>`; expórtalo por `index.ts`.
4. Compón dependencias en `app`. Conserva rutas, claves, formatos, ids y clases CSS.
5. Prueba reglas con entidades y adaptadores falsos, fronteras de DTO y navegación E2E.

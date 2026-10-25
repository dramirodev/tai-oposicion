# Arquitectura de Preparación TAI

## Estado real de la migración

La estructura de carpetas refleja el destino (`core`, `adapters`, `features`, `shared`, `app`), pero los límites aún no están cerrados. Las pantallas siguen en `features/*/legacy.ts` y `app/legacy-router.ts`. `core/application/legacy-engine.ts` todavía importa directamente el store y el banco heredados y usa `legacy/logic.ts`; por tanto, no es aún un caso de uso aislado por puertos. El store, el banco HTTP, Firebase, offline y `legacy-dom` conservan su API compacta actual para que el puente mantenga el comportamiento.

El prototipo paralelo de sesiones fue retirado en `9540f8e`; el motor de referencia sigue siendo `core/application/legacy-engine.ts`, `legacy/logic.ts` y `adapters/local/legacy-store.ts`. Las reglas puras de selección (`selection.ts`), puntuación (`scoring.ts`), análisis (`simulation-analysis.ts`), repaso espaciado (`spaced-repetition.ts`) y trampas (`traps.ts`) ya se extraen en `core/domain`. `legacy/logic.ts` conserva wrappers para los formatos compactos que consumen el motor y las pantallas heredadas. Formato HTML, escape, tiempo, etiquetas y aviso de reanudación están en `shared/presentation/study-text.ts`, `format.ts`, `study-labels.ts` y `pending-run.ts`. `shared/presentation/legacy-study.ts` recibe los datos verificados por parámetro, sin importar adaptadores; la próxima fecha de repaso de tarjetas está en `core/domain/spaced-repetition.ts`.

Estas extracciones se comparan con las pruebas heredadas; no cambian selección, puntuación, calendario, serialización ni ritmo. Quedan reglas de dominio en `legacy/logic.ts` y en el adaptador del banco por extraer. El estado `run` ya no se exporta ni se muta desde fuera del motor: se consulta mediante `getSnapshot()` y cambia por acciones públicas. `legacy-router` conserva objetos de sesión de solo lectura para pintar la pantalla. El estado observable de sincronización vive en `adapters/firebase/legacy-sync-state.ts` y se publica por el puerto `core/ports/SyncGateway.ts`; `syncStatusMapper` convierte el campo externo `ts` a `requestedAt`. `Layout` consume el snapshot del puerto. Las pantallas del puente todavía usan la fachada Firebase con su modelo heredado.

El estado de diálogos y toast está encapsulado en `shared/ui/dialog-store.ts`, con `subscribe()` y `getSnapshot()`; `dialogs.tsx` expone la API de promesas y monta el único proveedor React. No existe otro `createSessionController` ni otra API `startQuickSession`/`finishSession`: las funciones actuales de sesión son parte del motor de referencia y están conectadas al puente.

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

**Dominio:** `Preferences` tipa las secciones `ui`, `test`, `sim`, `cardsc`, `evo`, `simc` y `slow`; el mapper local comprueba los esquemas existentes sin pasar los DTO al dominio. `Question` usa `{ id, topicId, origin, statement, options, correctIndex }`; `QuestionStats` usa `attempts`, `correct`, `lastSeenAt` y propiedades nombradas.

**View model:** la futura `QuestionCardVM` tendrá etiquetas, HTML y estado de opciones listos para pintar. Aún no hay view models conectados al puente.

Los DTO se definen en `adapters/*/dto`; los mappers DTO ↔ dominio en `adapters/*/mappers`; los mappers dominio → view model en `features/<feature>/mappers`. Texto escapado, HTML, fechas y formatos visuales van en `shared/presentation`. Los `toDomain` devuelven resultado explícito y conservan `TODO(zod)` para la fase de esquemas. El mapper del banco devuelve la entidad `Question` junto a metadatos propios del adaptador (orden original de claves y avisos), de forma que la ida y vuelta serializada conserve el orden sin introducir DTO en el dominio; el diagnóstico de banco informa en desarrollo, una vez, de campos desconocidos y preguntas inválidas sin descartarlas del flujo legado. `progressMapper` informa las claves y motivos de registros corruptos y conserva el resto del progreso; su prueba cubre un registro inválido junto a uno válido. `preferencesMapper` valida las preferencias con `adapters/local/config.ts` y conserva los valores válidos.

## Reglas y excepciones de lint

`npm run lint` usa ESLint flat config, `eslint-plugin-import` (`import/no-restricted-paths`), TypeScript ESLint y `eslint-plugin-react-hooks`. Restringe imports por capa, APIs del navegador, fechas del sistema y `Math.random()` en dominio; prohíbe `dangerouslySetInnerHTML`. Los alias están configurados en TypeScript y Vite: `@core`, `@adapters`, `@features`, `@shared`, `@app`; los imports existentes todavía no se han convertido todos.

La lista de exclusiones vigente es el bloque `ignores` de `eslint.config.mjs`: `src/core/application/legacy-*.ts`; `src/adapters/legacy/types.ts`; `src/legacy/**`; `src/features/**/legacy.ts`; `src/shared/ui/legacy-dom.ts`; `src/adapters/firebase/legacy-sync.ts`; `src/app/legacy-router.ts`. Se retiran una a una cuando pasan las reglas. El motor legado aún importa directamente store y banco; `core`, `adapters` y `shared` no están todos fuera de las exclusiones.

## Añadir una feature

1. Define entidades y reglas puras; inyecta reloj y azar. Añade un caso de uso por acción y un puerto por necesidad de IO.
2. Implementa el puerto en `adapters`; traduce DTO con mappers puros y prueba ida/vuelta persistida.
3. Añade view model, mapper de presentación, hook y componente en `features/<nombre>`; expórtalo por `index.ts`.
4. Compón dependencias en `app`. Conserva rutas, claves, formatos, ids y clases CSS.
5. Prueba reglas con entidades y adaptadores falsos, fronteras de DTO y navegación E2E.

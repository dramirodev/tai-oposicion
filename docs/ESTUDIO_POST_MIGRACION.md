# Inventario y regresión: mejoras de estudio

## Base comprobada

- Rama de trabajo: `mejoras-estudio`, worktree aislado.
- HEAD base: `631a7f5` (merge de migración); árbol idéntico al commit final `3d330e6` de `migracion-react`.
- No había cambios versionados o sin seguimiento en la rama de trabajo al empezar. El plan local está ignorado por Git y se mantiene sin modificar.
- El motor real está en `src/core/application/legacy-engine.ts`, con reglas heredadas restantes en `src/legacy/logic.ts` y progreso en `src/adapters/local/legacy-store.ts`. `src/app/legacy-router.ts` conecta las pantallas `src/features/*/legacy.ts`.

## Mapa de contratos existente

| Responsabilidad | Ruta real | Contrato / formato vigente |
|---|---|---|
| Sesión y respuestas | `src/core/application/legacy-engine.ts` | `Run` con `items`, `idx`, `ans`, `times`, `secs`, `paused`, revisión; sesiones `test`, `rev`, `sim`. Guardado resumido en `tai.run:<cuenta|guest>`. |
| Progreso agregado | `src/adapters/local/legacy-store.ts` | `tai.v1:<cuenta|guest>`; `stats` usa array posicional, `sessions` resultado agregado, `cards` array posicional. `importAll` fusiona y no reemplaza la copia actual. |
| Recuperación local | `src/adapters/local/legacy-store.ts` | respaldo IndexedDB `tai-mirror`, claves `state:<cuenta|guest>`; recuperación restringida al propietario para copias sin ámbito. |
| DTO y mappers de progreso | `src/adapters/local/dto/progress.ts`, `src/adapters/local/mappers/{stats,session,card,report,preferences,progress}.ts` | Traducción explícita DTO ↔ dominio; el historial agregado no contiene eventos por respuesta. |
| Puertos | `src/core/ports/{ProgressRepository,SessionRepository,BankRepository,SyncGateway,AccessGateway,Clock,OfflineCache}.ts` | Modelos de dominio para APIs nuevas; el motor puente conserva accesos heredados directos. |
| Adaptador de banco | `src/adapters/http/legacy-data.ts`, `src/adapters/http/bank-repository.ts`, `src/adapters/http/mappers/question.ts` | URLs públicas `data/*.json`, `cards/*.json`; caché por tema. |
| Sincronización / reglas | `src/adapters/firebase/legacy-sync.ts`, `src/adapters/firebase/sync-facade.ts`, `src/adapters/firebase/legacy-sync-state.ts`, `firestore.rules` | stats por tema, sesiones y documentos `cfg/*`; las reglas existentes se leen y no se modifican en fase 0. |
| Composición y ciclo de vida | `src/app/{main.tsx,App.tsx,Layout.tsx,LegacyRoute.tsx,legacy-router.ts}` | Hash router React y puente legado; registro SW, guardado al ocultar/cerrar, sincronización y recuperación pendientes. |
| Presentación / diálogos | `src/shared/presentation/*`, `src/shared/ui/{dialogs.tsx,dialog-store.ts,legacy-dom.ts}` | Formatos reutilizables y proveedor de diálogos; no hay sistema de ayuda específico disponible todavía. |
| Pantallas heredadas | `src/features/{home,access,cards,settings,stats,trainers}/legacy.ts`, más handlers en `src/app/legacy-router.ts` | Conservan IDs, clases y comportamiento del HTML/CSS actual. |
| Pruebas | `tests/*.test.js`, `tests/domain/*.test.js`, `tests/adapters/*.test.js`, `tests/e2e/*.spec.ts` | Vitest cubre motor/store, mappers e interfaz jsdom; Playwright recorre rutas en Chromium y WebKit. |

## Matriz de regresión inicial

| Área | Evidencia automatizada inicial | Comprobación adicional prevista |
|---|---|---|
| Tests, quizzes, simulacros, penalización y puntuación | `tests/app.test.js`, `tests/logic.test.js`, `tests/scored.test.js`, `tests/regressions.test.js`; 17 rutas E2E | Recorrido integral con pendientes, consultas y finalización en fase 7 |
| Falladas, dudosas, rachas y repaso | `tests/store.test.js`, `tests/regressions.test.js`, `tests/domain/spaced-repetition.test.js` | Coherencia tras responder/revelar y revisar en fase 7 |
| Tarjetas | `tests/cards.test.js`, `tests/domain/flashcards.test.js`, `tests/store.test.js` | Preservación de progreso antiguo y posterior a los cambios |
| Supuestos, trampas, lectura, relámpago y temario | `tests/app.test.js`, `tests/logic.test.js`, `tests/domain/traps.test.js`; Playwright rutas | Navegación, estado y funcionamiento offline |
| Cuenta, invitado, acceso y sincronización | `tests/account-recovery.test.js`, `tests/sync.test.js`, `tests/mappers/access.test.js` | Aislamiento de ámbitos y listeners cancelados; sync real se reportará aparte |
| Copias, importación y recuperación antigua | `tests/store.test.js`, `tests/mappers/progress.test.js`, `tests/regressions.test.js`; `tests/legacy-fixtures.test.js` | Importación repetida, IndexedDB y cuenta en fase 7 |
| Offline, SW, CSP y rutas | `tests/sw.test.js`; E2E service worker en Chromium/WebKit | Prueba física Safari/iPadOS no sustituida por emulación |
| Subrayado, confianza, motivo, “No lo sé” y “Ver solución” | Sin contrato antes de la implementación | Pruebas de transición de intento + E2E en fases 2–3 |
| Ayuda, explicación editorial y exportación IA | Sin contrato antes de la implementación | Cobertura y revisión editorial/manual en fases 2A, 4 y 6 |
| Analíticas y recomendaciones | Estadísticas agregadas existentes; sin historial por intento | Umbral, denominadores, abstención y cálculos reproducibles en fase 5 |

## Archivos previstos por responsabilidad

Los destinos concretos se ajustarán al código real, sin introducir versiones paralelas del motor.

- `src/core/domain/attempts/*`: transiciones puras, estados, eventos y cómputo de tiempo.
- `src/core/application/attempts/*`, `src/core/ports/AttemptRepository.ts`: orquestación y contrato de persistencia idempotente.
- `src/adapters/local/*` y `src/adapters/firebase/*`: persistencia por ámbito, recuperación, sincronización y borrado versionado, conservando las claves/DTO anteriores.
- `src/features/{test,quiz,sims,results,stats,settings,home}/**`: ayuda, estados de pregunta, señales de práctica, panel analítico y exportación; pantallas aún heredadas siguen pasando por `legacy.ts`.
- `src/shared/{ui,presentation}/**`: controles accesibles de ayuda, marcas, explicaciones y formatos ya preparados.
- `tests/attempts/**`, `tests/features/**`, `tests/e2e/**`, `tests/fixtures/**`: contratos por capa, integraciones y casos antiguos.
- `docs/ARQUITECTURA.md`, `docs/ESTUDIO_POST_MIGRACION.md`: arquitectura real, decisiones, regresión y límites de evidencia.

## Línea base antes de editar

| Comando | Resultado |
|---|---|
| `npm ci` | OK; 0 vulnerabilidades. npm mostró avisos de mantenimiento de ESLint y scripts de instalación no aprobados. |
| `npm run lint` | OK |
| `npm run lint:ignore-growth` | FALLA preexistente: `HEAD^` no contiene `eslint.config.mjs` por ser un merge cuya primera rama precede a la migración. Corregido en fase 0 para elegir el padre más cercano con ese archivo. |
| `npm run typecheck` | OK |
| `npm test` | OK: 50 archivos, 288 pruebas |
| `npm run build` | OK; bundle inicial 499.77 kB (167.99 kB gzip), chunk `legacy-sync` 540.29 kB (128.95 kB gzip); aviso existente por chunk mayor a 500 kB. |
| `node scripts/validate_cards.mjs` | OK: 36 temas |
| `npm run test:e2e` | OK: 80 pruebas Chromium y WebKit; 17 rutas, modos claro/oscuro, invitado, SW/CSP/offline. |

Las capturas y E2E son emulación Playwright. No acreditan una prueba física de Safari/iPadOS, sincronización real entre dispositivos ni revisión editorial humana.

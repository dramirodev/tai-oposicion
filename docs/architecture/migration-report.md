# Informe de migración arquitectónica

## Estado

**Etapa A (auditoría y propuesta): completa y publicada en la PR #38**, ahora reapuntada a `main` después del merge de PR #34. No se modificó código de producción. **Etapa B: pendiente de aprobación del usuario.**

La propuesta preserva las capas ya existentes y prioriza extraer un slice estadístico de solo lectura antes de atacar la sesión de estudio y la sincronización, por su menor riesgo de datos. Propone evaluar Zustand con un único estado efímero compartido y conservar `useState` para lo local; la biblioteca no está instalada en el checkout auditado y no debe añadirse en Etapa A.

## Cambios hechos en Etapa A

- Añadidos `audit.md`, `target-architecture.md`, `dependency-rules.md`, `migration-plan.md` y este informe.
- Actualizado el handoff del proyecto con estado, evidencia y siguiente paso.
- PR #38 abierta contra `main`; se conservó la documentación y se actualizó la base después del merge de #34.
- Sin cambios en páginas, lógica de negocio, reglas Firebase, esquema persistido, dependencias, tests de producción ni configuración.

## Evidencia y validación

- Rama inspeccionada y revalidada: `docs/architecture-audit-stack`; base `main` (`095a0e1`), que contiene PR #34. PR #36 está abierta contra `main`; PR #37 sigue apilada sobre #36.
- `npm run check:architecture`: **correcto**, “sin deuda nueva; 64 excepciones pendientes”.
- Scanner AST ejecutado en el checkout: 64 findings (67 ocurrencias contando los agregados), 45 importaciones legacy, 14 módulos legacy, 5 escrituras HTML y 3 dependencias de capa; los tres imports de capa son de `core/application/legacy-engine.ts` a adaptadores/tipos legacy.
- Revisión estática: `legacyPaths` está vacío; rutas hash y componentes lazy están en `route-runtime.tsx`; `App.tsx` aún compone `studyServices` y arranca `bootLegacy` desde `legacy-router.ts`.
- No se ejecutaron tests, lint, TypeScript ni build: la Etapa A solo añade documentos y no cambia código de aplicación. La validación funcional corresponde a las PR de implementación.

## Bloqueos y límites

- El diagnóstico se revalidó tras el merge de PR #34; debe repetirse si cambia `main` antes de Etapa B.
- La comprobación actual no prueba ausencia de dependencias circulares. No se afirma que haya ciclos; implementar/controlar esta propiedad queda en el plan.
- No se midió rendimiento de runtime ni se ejecutó un flujo autenticado/Firestore. Esos límites importan para futuros cambios de persistencia y sincronización.
- No se instaló Zustand ni se ha demostrado que su adopción mejore de forma medible el estado global. La primera fase debe evaluar un uso acotado con criterios de selector/re-render y tests.

## Siguiente paso

1. Revisar y aprobar la propuesta arquitectónica.
2. Tras integrar la PR #34, reapuntar esta rama a `main` y repetir `npm run check:architecture` y el inventario.
3. Con aprobación, iniciar el slice de Progreso/estadísticas en una rama de implementación apilada, con tests y compatibilidad; no comenzar moviendo el motor de estudio.

## Etapa B — avance 2026-10-27

La instrucción actual del usuario autoriza continuar la implementación de las tareas pendientes. Este primer incremento aborda el agregado de rendimiento por tema:

- `StatsSnapshot`, las semanas y los modelos de comparación están ahora en `core/application/stats/statistics-model.ts`, en lugar de definirse junto al contexto React compartido. El contexto conserva reexports para compatibilidad, mientras la composición y páginas de Progreso importan el modelo de aplicación directamente.
- `summarizeTopicProgress` recibe registros normalizados y un catálogo de temas; calcula respuestas, aciertos, porcentajes, vistas y prioridades con el umbral previo de ocho respuestas. No importa React, Zustand, Firebase ni almacén local.
- `stats-composition.ts` adapta los datos existentes al modelo normalizado y mantiene la consulta local/HTTP, la comprobación de cuenta, los demás agregados y las acciones. No se cambian contratos persistidos, UI ni flujos.
- Se añadió `tests/topic-progress.test.js` para verificar totales, umbral, orden, límite, cero datos y catálogo sin respuestas.
- No se añadió un puerto de lectura nuevo: la función extraída es una transformación pura de valores ya obtenidos por la composición existente; crear una interfaz alrededor de esos mismos valores no separaría una operación de IO adicional. El límite actual de lectura en la composición queda como deuda de la siguiente revisión arquitectónica.
- Validación local: arquitectura sin deuda nueva (64 excepciones preexistentes), ESLint, ignore-growth, TypeScript y Vitest serial **404/404**; build de producción correcto; E2E focalizada de progreso/gráficas **10/10** en Chromium/WebKit, claro/oscuro.

Siguiente: terminar y publicar el slice actual como PR apilada en la PR #43. Después, evaluar el store vanilla Zustand v5.0.12 para estado efímero compartido de diálogos/toasts; usar selectores en React, pruebas de transiciones y no persistir nada. Context7: biblioteca `/pmndrs/zustand`; consulta oficial de store vanilla y `useStore` selectivo completada. Las etapas restantes (contrato por feature, engine, router/arranque, DTOs y guardas de ciclos) continúan pendientes.

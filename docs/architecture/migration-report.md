# Informe de migración arquitectónica

## Estado

**Etapa A (auditoría y propuesta): completa en esta rama.** No se modificó código de producción. **Etapa B: pendiente de aprobación del usuario.**

La propuesta preserva las capas ya existentes y prioriza extraer un slice estadístico de solo lectura antes de atacar la sesión de estudio y la sincronización, por su menor riesgo de datos. Propone evaluar Zustand con un único estado efímero compartido y conservar `useState` para lo local; la biblioteca no está instalada en el checkout auditado y no debe añadirse en Etapa A.

## Cambios hechos en Etapa A

- Añadidos `audit.md`, `target-architecture.md`, `dependency-rules.md`, `migration-plan.md` y este informe.
- Actualizado el handoff del proyecto con estado, evidencia y siguiente paso.
- Sin cambios en páginas, lógica de negocio, reglas Firebase, esquema persistido, dependencias, tests de producción ni configuración.

## Evidencia y validación

- Rama inspeccionada: `docs/architecture-audit-stack`; base publicada `feat/migrate-cards-screen` (`32796db`). PR #34 está abierta contra `main`; PR #36 y #37 están abiertas y apiladas sobre los cambios de #34.
- `npm run check:architecture`: **correcto**, “sin deuda nueva; 64 excepciones pendientes”.
- Scanner AST ejecutado en el checkout: 64 findings (67 ocurrencias contando los agregados), 45 importaciones legacy, 14 módulos legacy, 5 escrituras HTML y 3 dependencias de capa; los tres imports de capa son de `core/application/legacy-engine.ts` a adaptadores/tipos legacy.
- Revisión estática: `legacyPaths` está vacío; rutas hash y componentes lazy están en `route-runtime.tsx`; `App.tsx` aún compone `studyServices` y arranca `bootLegacy` desde `legacy-router.ts`.
- No se ejecutaron tests, lint, TypeScript ni build: la Etapa A solo añade documentos y no cambia código de aplicación. La validación funcional corresponde a las PR de implementación.

## Bloqueos y límites

- El diagnóstico se basa en la punta de PR #34; debe repetirse después del merge antes de Etapa B.
- La comprobación actual no prueba ausencia de dependencias circulares. No se afirma que haya ciclos; implementar/controlar esta propiedad queda en el plan.
- No se midió rendimiento de runtime ni se ejecutó un flujo autenticado/Firestore. Esos límites importan para futuros cambios de persistencia y sincronización.
- No se instaló Zustand ni se ha demostrado que su adopción mejore de forma medible el estado global. La primera fase debe evaluar un uso acotado con criterios de selector/re-render y tests.

## Siguiente paso

1. Revisar y aprobar la propuesta arquitectónica.
2. Tras integrar la PR #34, reapuntar esta rama a `main` y repetir `npm run check:architecture` y el inventario.
3. Con aprobación, iniciar el slice de Progreso/estadísticas en una rama de implementación apilada, con tests y compatibilidad; no comenzar moviendo el motor de estudio.

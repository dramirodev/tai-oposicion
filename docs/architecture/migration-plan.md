# Plan de migración arquitectónica

Complejidad relativa: **baja** (cambio localizado y bajo riesgo), **media** (varias capas o flujos), **alta** (persistencia, sesiones, sincronización o rutas críticas). Las etapas de producción requieren aprobación de la propuesta y se implementarán en PR pequeñas apiladas según el flujo del proyecto.

| Orden | Trabajo | Complejidad | Resultado y validación |
|---:|---|---:|---|
| 0 | Alinear rama con `main` tras integrar PR #34 y revalidar este diagnóstico | Baja | Confirmar que el inventario sigue vigente; no cambiar contratos. |
| 1 | Extraer Progreso/estadísticas como primer vertical slice de solo lectura | Media | Implementado y fusionado mediante PR #49; la agregación de rendimiento por tema queda en una función pura tipada. |
| 2 | Reducir contrato global `StudyServices` por feature sin mover estado persistido | Media | Implementado en esta PR #46; cada pantalla solicita solo los servicios que consume y la composición mantiene el agregado. |
| 3 | Delimitar estado efímero compartido y evaluar Zustand en una sola rebanada | Baja/media | Implementado y fusionado mediante PR #45 para diálogos/toasts, con selectores y sin persistencia. |
| 4 | Desacoplar `core/application/legacy-engine.ts` de persistencia/datos legacy | Alta | PR #50 separa la lectura y validación de sesión guardada en un caso de uso con dominio y adaptador local; conserva el contrato `tai.run:<cuenta>`. |
| 5 | Extraer composición/arranque de `legacy-router.ts` y retirar renderer muerto | Alta | Primer slice en PR #47: renderer HTML sin rutas activas retirado y bootstrap renombrado a servicios de aplicación. La extracción adicional del arranque de service worker/sync sigue pendiente. |
| 6 | Encapsular DTO y modelos legacy en mappers/adapters | Media/alta | UI/dominio reciben modelos internos; adapters conservan lectura compatible de datos antiguos. Contratos externos sin cambios. |
| 7 | Cierre de guardas y limpieza validada | Media | No new architecture debt, chequeo de ciclos, lint, typecheck, tests, build y E2E de rutas críticas. Retirar únicamente código sustituido sin referencias. |

### Estado de ejecución — actualización 2026-10-27

- Base comprobada: `origin/main` `4c70512`, con las PR #43, #45, #47, #48 y #49 integradas.
- PR #44 se fusionó accidentalmente en la rama de iconografía; su reemplazo #49 incorporó el slice de estadísticas a `main`.
- PR #45 (Zustand para estado efímero de diálogos/toasts) está integrada en `main`.
- Orden 2: esta PR #46 aísla los servicios usados por cada pantalla; su rama se está rebasando de nuevo sobre `main` tras la integración de #47.
- Orden 4: PR #50 contiene la extracción acotada de recuperación de sesión guardada, basada directamente en `main`; `npm run check` pasó 409/409, el build pasó y el E2E de reanudación pasó 2/2 en Chromium/WebKit.
- Orden 5: PR #47 retiró el renderer React legacy sin reemplazar el arranque todavía necesario; está integrada en `main`.
- Órdenes 6 (DTO/mappers) y 7 (guardas finales/ciclos) siguen pendientes, después de revisar las fronteras activas y no como limpieza mecánica.
- Nueva tarea de producto pendiente: loading accesible en Inicio mientras se resuelven los datos necesarios y Firebase Auth; mostrar después la vista adecuada a una sesión confirmada o a invitado. Ver detalle y casos de validación en el handoff.

## Procedimiento por slice

1. Reconfirmar el comportamiento actual y el estado de `main`.
2. Identificar consumidores, escrituras, IDs, formatos y efectos secundarios.
3. Crear una seam mínima (modelo/puerto/caso de uso) respaldada por una prueba que hoy sea difícil o imposible.
4. Implementar adapter y mapper sin cambiar el formato externo.
5. Conectar en composición y migrar consumidores de una feature.
6. Ejecutar las comprobaciones del proyecto y los E2E del flujo afectado; inspeccionar diffs de datos y snapshots cuando corresponda.
7. Retirar código anterior solo después de búsqueda de referencias y prueba de regresión.
8. Actualizar este plan y el informe, crear cada PR directamente contra `main` y no esperar a CI salvo petición expresa.

## Riesgos y mitigación

- **Historial y progreso:** fixtures de almacenes antiguos antes de tocar mappers; no reescribir ni migrar almacenamiento sin prueba de ida/vuelta.
- **Aislamiento:** todas las operaciones async deben revalidar el `accountId` antes de guardar o publicar resultados.
- **Offline:** probar al menos la carga de rutas/datos instalados y la recuperación de una sesión sin red.
- **Puntuación:** casos de uso nuevos deben delegar en reglas existentes y mantener ejemplos históricos de test/simulacro.
- **Scope:** un PR por vertical slice; no mezclar cambios visuales o dependencias que no sean necesarias.
- **Cambios concurrentes en documentación:** mantener los estados comprobados al actualizar el handoff y resolver conflictos sin descartar el registro de otras tareas.

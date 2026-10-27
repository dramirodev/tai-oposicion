# Plan de migración arquitectónica

Complejidad relativa: **baja** (cambio localizado y bajo riesgo), **media** (varias capas o flujos), **alta** (persistencia, sesiones, sincronización o rutas críticas). Las etapas de producción requieren aprobación de la propuesta y se implementarán en PR pequeñas apiladas según el flujo del proyecto.

| Orden | Trabajo | Complejidad | Resultado y validación |
|---:|---|---:|---|
| 0 | Alinear rama con `main` tras integrar PR #34 y revalidar este diagnóstico | Baja | Confirmar que el inventario sigue vigente; no cambiar contratos. |
| 1 | Extraer Progreso/estadísticas como primer vertical slice de solo lectura | Media | Implementado; PR #49 lleva el slice a `main` después de que #44 se fusionara accidentalmente en la rama de iconografía. |
| 2 | Reducir contrato global `StudyServices` por feature sin mover estado persistido | Media | Implementado en PR #46; cada pantalla pide solo los servicios que usa. PR en proceso de quedar dirigida a `main`. |
| 3 | Delimitar estado efímero compartido y evaluar Zustand en una sola rebanada | Baja/media | Implementado en PR #45 para diálogos/toasts; store vanilla, selectores y pruebas, sin persistencia. |
| 4 | Desacoplar `core/application/legacy-engine.ts` de persistencia/datos legacy | Alta | Declarar puertos mínimos para banco, progreso, reloj/sesión según necesidad; conectar adaptadores en `app`; tests con fakes; preservar selección, respuesta, pausa, reanudación y resultados. |
| 5 | Extraer composición/arranque de `legacy-router.ts` y retirar renderer muerto | Alta | Separar composición por feature, bootstrap/service worker/sync, controladores de flujo y representación; buscar referencias antes de retirar cualquier export/render. Probar cada ruta React y deep link. |
| 6 | Encapsular DTO y modelos legacy en mappers/adapters | Media/alta | UI/dominio reciben modelos internos; adapters conservan lectura compatible de datos antiguos. Contratos externos sin cambios. |
| 7 | Cierre de guardas y limpieza validada | Media | No new architecture debt, chequeo de ciclos, lint, typecheck, tests, build y E2E de rutas críticas. Retirar únicamente código sustituido sin referencias. |

### Estado de ejecución — actualización 2026-10-27

- Base comprobada: `origin/main` `7e2cd29`, que contiene la PR #43 de iconografía y hover táctil.
- PR #44 fue fusionada por error en `fix/menu-iconography-mobile-hover`; sus cambios de estadísticas no llegaron a `main`. La rama de reemplazo `feat/architecture-stats-main` / PR #49 apunta directamente a `main`.
- PR #45 (Zustand), #46 (servicios por feature) y #47 (retirada del renderer inactivo) están siendo rebasadas como cambios independientes contra `main`.
- Orden 4: en curso la extracción acotada de recuperación de sesión guardada; mantiene formato, almacenamiento por cuenta, expiración, acceso y comprobación de sesión tras la consulta.
- Órdenes 5 (bootstrap restante), 6 (DTO/mappers) y 7 (guardas finales) siguen pendientes después de este slice.

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

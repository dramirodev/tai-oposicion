# Reorganización por arquitectura limpia: plan de implementación

> Plan de trabajo por etapas, ejecutado en línea con una comprobación completa y un commit al cerrar cada etapa.

**Objetivo:** Llevar la app existente a `core/domain`, `core/application`, `core/ports`, `adapters`, `features`, `shared` y `app`, conservando comportamiento, almacenamiento y URLs.

**Arquitectura:** Los adaptadores traducen formatos externos a entidades y viceversa; los casos de uso coordinan puertos; el dominio contiene reglas puras; las features presentan view models; `app` compone dependencias. El puente legado permanece como adaptador temporal hasta migrar sus pantallas.

**Stack:** TypeScript estricto, React 19, React Router 7, Vite 6, Vitest, Playwright, ESLint flat config.

**Especificación:** Instrucciones del usuario del 2026-10-25 en la conversación.

## Restricciones globales

- Mantener literalmente las claves y formatos existentes de localStorage, IndexedDB y Firestore.
- Mantener rutas hash, recursos públicos, IDs, clases CSS, CSP sin scripts inline y compatibilidad Safari 15.
- No debilitar ni eliminar pruebas; cubrir mappers con ida y vuelta y el banco/progreso reales.
- No manejar credenciales ni editar `firestore.rules`; no hacer push ni despliegue.
- Cerrar cada etapa con `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `node scripts/validate_cards.mjs` y E2E.

## Enfoque de revisión

- Registro compacto de estadísticas con colas opcionales: ida y vuelta byte a byte en JSON.
- Preguntas con campos opcionales/null y metadatos editoriales: ida y vuelta sin omisiones.
- Cambio de cuenta, recuperación asíncrona y sincronización Firebase: aislar progreso entre cuentas.
- Navegación/hash, CSS global y service worker: conservar las 17 rutas y caché offline.
- Importación del banco completo: verificar los 36 JSON de tema sin normalización destructiva. El inventario raíz tiene 39 JSON en total (36 temas, `index.json`, `meta.json` y `supuestos.json`).

## Etapa 1: movimientos puros

Inventariar cada módulo y sus imports. Mover el código existente con `git mv` a las carpetas nuevas, manteniendo implementaciones temporales explícitamente marcadas como legado cuando los modelos actuales mezclen DTO y dominio. Actualizar imports, entrada de Vite, pruebas y documentación. No alterar reglas ni formatos.

**Cierre:** cinco verificaciones globales, inspección del diff para confirmar movimientos/imports solamente y commit `refactor: ubicar modulos en arquitectura objetivo`.

## Etapa 2: modelos y mappers aislados

Definir entidades de dominio estrictas y DTO tipados por adaptador. Crear mappers puros `questionMapper`, `statsMapper`, `sessionMapper`, `cardMapper`, `reportMapper`, `accessMapper` y `firestoreIdMapper`. Los `toDomain` devuelven resultado explícito ante datos inválidos y llevan `TODO(zod)`. Añadir pruebas individuales de ida y vuelta, prueba de todos los `public/data/T*.json`, y fixture de progreso generado desde `store` para cubrir todos los registros.

**Cierre:** verificar mappers y toda la suite; commit `feat: definir entidades dto y mappers`.

## Etapa 3: puertos y adaptadores (base verificable)

Definir puertos en términos de entidades, reglas puras de puntuación/registro, casos de uso de sesión, repositorio local compatible con el store actual y repositorio HTTP que mapea y cachea por tema. Mantener la API compatible del puente hasta conectar todas las pantallas a los casos de uso. Firebase, offline e IndexedDB siguen siendo módulos heredados pendientes de adaptar por separado; esta etapa no cambia su IO ni sus formatos.

**Cierre:** cinco verificaciones globales más E2E; commit `refactor: conectar casos de uso y adaptadores`.

## Etapa 4: presentación, límites y documentación

Organizar pantallas como `features/<feature>/legacy.ts` mientras no se migren; dejar UI genérica y formato reutilizable en `shared`; composición, providers, router y ciclo de vida en `app`. Añadir mappers de view model para pantallas React, ESLint flat config con reglas de límites indicadas, alias `@core`, `@adapters`, `@features`, `@shared`, `@app`, script `lint` y CI antes de tests. Documentar capas, DTO, entidades, view models, mappers y alta de una feature en `docs/ARQUITECTURA.md`.

**Cierre:** cinco verificaciones globales; inspección de dependencias con ESLint; commit `feat: aplicar limites de capas y documentar arquitectura`.

## Autorrevisión de cobertura

La etapa 1 cubre movimientos y compatibilidad; etapa 2 cubre los tres modelos, todos los mappers nombrados, TODO(zod), pruebas de ida y vuelta y datos reales; etapa 3 cubre puertos, composición y adaptadores de todos los sistemas existentes; etapa 4 cubre organización de features/shared/app, límites automáticos, CI y documentación. No se migran pantallas de `LegacyRoute` a JSX en este trabajo.

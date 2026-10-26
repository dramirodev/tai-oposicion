# Reglas de dependencias

## Reglas obligatorias

1. `core/domain` no importa React, Zustand, Firebase, React Router, `idb`, DTO ni ningún archivo de otra capa. Debe poder ejecutarse como TypeScript puro.
2. `core/application` puede importar `core/domain` y `core/ports`. No importa `adapters`, `app`, `features`, `shared`, React ni librerías de infraestructura.
3. `core/ports` declara tipos y contratos usando modelos de dominio; no contiene implementaciones.
4. `adapters` implementa puertos. Puede depender de Firebase, HTTP, IndexedDB, DTO y mappers, además de `core/domain` y `core/ports`; no importa `app` ni `features`.
5. `features` depende de modelos de presentación, hooks y contratos de aplicación expuestos por composición. No importa Firebase ni adaptadores concretos, y no coordina acceso directo al store persistente.
6. `app` contiene router, providers y composición raíz. Es el único lugar que conecta casos de uso y adaptadores concretos con las features.
7. `shared` contiene solo componentes, utilidades y tipos realmente comunes. No importa `features`, `adapters` ni `app`; tampoco debe ser un atajo para compartir todos los servicios de producto.
8. No permitir ciclos entre módulos ni rutas de importación que eviten las reglas mediante reexports o `import()` dinámico.
9. Las migraciones mantienen las URLs hash, claves y esquemas persistidos, DTO Firestore, IDs, sincronización por cuenta y comportamiento offline, salvo autorización explícita para cambiar un contrato.

## Estado actual vs. destino

La comprobación `npm run check:architecture` pasó en el checkout auditado: 64 excepciones conocidas, sin crecimiento respecto de la base. El scanner sí detecta importaciones de capa, módulos/imports con nombre `legacy`, escrituras de HTML e imports de DTO/modelos de vista entre capas; todavía no garantiza por sí solo que no haya ciclos ni que cada regla semántica anterior se cumpla.

Tres incumplimientos actuales se localizan en `src/core/application/legacy-engine.ts`: importa store local, repositorio de datos HTTP y tipos legacy. El primer cambio de producción deberá eliminar esas dependencias mediante contratos pequeños y composición, no mediante una excepción nueva. La deuda en adapters entre sí (por ejemplo, sincronización legacy y store local) se mantiene temporalmente detrás de su propia frontera; desacoplarla se programa solo cuando aporte una sustitución/prueba concreta.

## Refuerzo incremental de controles

- Mantener el guard actual sin aumentar el baseline.
- Añadir una comprobación de ciclos cuando se acuerde una herramienta que no requiera una dependencia de runtime nueva o cuando el script existente pueda hacerlo con TypeScript.
- Añadir pruebas de contrato para cada repositorio crítico (legacy data, progreso local, intentos e historial remoto).
- En una PR, reducir o mantener el número de excepciones; explicar cualquier excepción temporal con razón, tarea y responsable de eliminación.
- No introducir `any`, `@ts-ignore`, supresiones de lint ni `eslint-disable` para eludir límites.

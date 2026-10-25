# Historial de intentos: esquema y recuperación

## Compatibilidad

El historial detallado es opcional y versionado; no sustituye ni cambia el formato agregado `tai.v1`,
las sesiones pendientes `tai.run:*`, las tarjetas ni los documentos existentes de sincronización. Las
estadísticas previas a activar este historial siguen siendo válidas, pero no se reconstruyen como
intentos/eventos. No se generan marcas de tiempo, confianza ni motivos históricos.

## Modelo y almacenamiento

Dominio: `QuestionAttemptSession`, `QuestionAttempt`, `AttemptEvent` y `Highlight` en
`src/core/domain/attempts/transitions.ts`. El evento es la evidencia secuenciada de una acción; los
campos derivados del intento guardan el estado actual para lectura paginada. Cada respuesta en práctica
produce una transición terminal y una sola actualización de progreso. Consultar una solución solo se
permite desde `pending`, deja `state: revealed`, `response/outcome: null` y no actualiza estadísticas.
Simulacro oculta corrección hasta cerrar la sesión.

Adaptador local: IndexedDB `tai-attempts`, versión 2, stores `sessions`, `attempts`, `events` y
`tombstones`; las claves de filas incluyen el ámbito (`guest` o la cuenta) y el ID. El sincronizador de
Firebase aplica el mismo aislamiento por cuenta. El formato de copia opcional es
`attemptHistory: { schemaVersion: 1, createdAt, sessions, attempts, events }`; los campos completos
están tipados en `src/adapters/local/dto/attempt*.ts`. Los mappers viven junto a esos DTO. La importación
valida cada registro, combina por IDs y no reemplaza el progreso actual. Una marca de borrado por ámbito
impide que una copia anterior restaure entradas eliminadas.

## Recuperación del usuario

1. No borres los datos del sitio ni reinstales para intentar recuperar una sesión. Abre de nuevo la app
   con el mismo perfil y cuenta; la app intenta restaurar su espejo local y ofrece reanudar `tai.run`.
2. Si tienes una copia descargada, entra en Ajustes → Copias de seguridad → Importar y confirma el
   resumen. La copia `tai-progreso.json` mantiene el progreso legado; `attemptHistory` es un bloque
   adicional opcional. La importación fusiona datos válidos y es idempotente para el historial.
3. Mantén la copia original hasta verificar progreso, tarjetas y sesiones reanudables. Usa el mismo
   ámbito de cuenta para importar datos de cuenta. Invitado y cada cuenta permanecen separados.
4. La descarga «Exportar análisis para IA» contiene solo las sesiones seleccionadas y es un artefacto
   manual para compartir. No es una copia completa para restaurar progreso.

El respaldo IndexedDB se prueba con `fake-indexeddb` y los escenarios antiguos con fixtures; estas pruebas
no simulan una cuota real agotada en iOS ni garantizan la recuperación física de datos borrados por el
navegador. La sincronización real entre dispositivos requiere una verificación separada con cuentas y
Firebase configurados.

## Cobertura de regresión relacionada

- Transiciones, respuesta duplicada/bloqueada, consulta y compatibilidad de sesiones antiguas:
  `tests/attempts/transitions.test.js`, `tests/attempts/engine-integration.test.js`,
  `tests/legacy-fixtures.test.js`.
- DTO y mappers de intentos/copias: `tests/mappers/attempt.test.js`,
  `tests/mappers/attempt-session.test.js`, `tests/mappers/attempt-archive.test.js` y
  `tests/attempts/archive.test.js`.
- Importación por ámbito, respaldo local y sincronización simulada: `tests/store.test.js`,
  `tests/account-recovery.test.js`, `tests/sync.test.js`.
- Rachas, repaso y tarjetas: `tests/domain/spaced-repetition.test.js`,
  `tests/domain/card-review-schedule.test.js`, `tests/domain/flashcards.test.js`,
  `tests/regressions.test.js`.
- Recorridos integrados en navegador: `tests/e2e/bridge.spec.ts`.

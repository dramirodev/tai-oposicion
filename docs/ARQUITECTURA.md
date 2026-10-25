# Arquitectura de Preparación TAI

## Capas y dirección

Las dependencias apuntan hacia el dominio. `core/domain` contiene entidades y reglas puras. `core/application` contiene acciones que coordinan puertos y publican estado observable. `core/ports` expresa las necesidades de la aplicación en tipos de dominio. `adapters` implementa esos puertos y traduce formatos de Firebase, HTTP, localStorage e IndexedDB. `features` conecta casos de uso con view models y componentes de pantalla. `shared` contiene UI y formato reutilizable. `app` crea adaptadores, ensambla casos de uso, configura el router y administra el ciclo de vida del navegador.

La composición no usa un contenedor de inyección: `app` construye los objetos y los pasa explícitamente. Las URLs hash, los recursos bajo `public/`, las claves existentes de persistencia y el CSS global siguen perteneciendo a la interfaz actual.

## Tres modelos

**DTO (frontera externa).** Una pregunta del banco mantiene claves compactas, por ejemplo `{ i: "TAI2024B-P1-01", t: "T1.01", o: "O", q: "…", a: ["…"], c: 0 }`. El progreso `tai.v1` conserva `stats` como arrays posicionales, `sessions`, `cfg`, `seen`, `reports` y `cards`. Estos formatos no se renombrarán en almacenamiento ni en Firestore.

**Dominio.** La misma pregunta se expresa con nombres completos: `{ id, topicId, origin, statement, options, correctIndex }`. `QuestionStats` usa `attempts`, `correct`, `lastSeenAt`, `intervalStep` y demás propiedades nombradas. Las reglas reciben el instante y la política como parámetros, no consultan el reloj ni el navegador.

**View model (pantalla).** La tarjeta de pregunta prevista para la feature quiz usa datos ya listos para pintar, por ejemplo `{ id, topicLabel, statementHtml, options: [{ letter, html, state }] }`. Los componentes recibirán ese modelo por props y emitirán ids y valores primitivos. Esta etapa mantiene las pantallas en `features/*/legacy.ts`; aún no hay view models de pantalla en producción.

## Mappers

Los DTO viven en `adapters/<tipo>/dto`; el mapper DTO ↔ dominio vive en `adapters/<tipo>/mappers`. Por ejemplo, `questionMapper` convierte el banco HTTP, `statsMapper` conserva el array histórico de `tai.v1`, y `accessMapper` incorpora el UID del documento Firestore. El progreso se traduce mediante mappers locales compuestos. Cada `toDomain` devuelve `{ ok, value }` o `{ ok, reason }` y deja un marcador `TODO(zod)` para la fase prevista de validación.

Los mappers de dominio a pantalla vivirán junto a cada feature, en `features/<feature>/mappers`. Formateo compartido de textos, fechas, tiempos y porcentajes pertenece a `shared/presentation`, nunca al dominio. Los DTO no se usan desde casos de uso o features y los view models no vuelven al dominio.

## Límites comprobados

`npm run lint` usa ESLint flat config, `eslint-plugin-import` (`import/no-restricted-paths`), TypeScript ESLint y `eslint-plugin-react-hooks`. `no-restricted-imports` complementa las zonas para el core, adapters, features y shared. En `core/domain` se prohíben APIs del navegador, fechas del sistema y aleatoriedad no inyectada. `dangerouslySetInnerHTML` está restringido; cuando se incorpore HTML enriquecido, la excepción será exclusivamente `shared/ui/CodeText`.

La composición en `app` puede importar adapters; las features y shared no. Los DTO y view models no deben importarse desde app ni core. Los alias de TypeScript y Vite son `@core`, `@adapters`, `@features`, `@shared` y `@app`.

**Excepción temporal del puente:** los archivos heredados `core/application/legacy-*.ts`, `features/*/legacy.ts`, `app/legacy-router.ts`, los adapters `legacy-*`, `legacy-store.ts`, `legacy-data.ts`, `sync-facade.ts`, `config.ts`, `offline/cache.ts`, `shared/presentation/legacy-study.ts` y utilidades de compatibilidad quedan excluidos del lint de migración mientras se conectan las pantallas. Conservan imports cruzados anteriores; no sirven como patrón para módulos nuevos. La excepción se retira al eliminar el puente. El estado sincronizado heredado también mantiene el tipo de acceso legacy hasta migrar Firebase.

## Añadir una feature

1. Añade el caso de uso nombrado en `core/application` y modela sus reglas en `core/domain`; define un puerto si requiere IO.
2. Implementa el puerto en `adapters`, con DTO y mappers escritos a mano junto al adaptador. Prueba valores válidos, inválidos e ida y vuelta del formato persistido.
3. Crea `features/<nombre>/view-models`, `mappers`, `hooks`, `components` e `index.ts`. El hook suscribe al caso de uso y prepara el view model; el componente no calcula reglas ni lee IO.
4. Inyecta el adaptador en `app`, enruta a la feature por su entrada pública y conserva ids, clases, URLs y estilos existentes.
5. Añade pruebas de dominio con entidades y puertos falsos, pruebas de mapper y un recorrido E2E. Ejecuta typecheck, lint, tests, build, validación de tarjetas y E2E.

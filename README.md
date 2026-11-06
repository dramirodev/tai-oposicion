# TAI · Preparación de oposiciones

TAI es una aplicación web progresiva (PWA) para preparar las oposiciones del cuerpo de Técnicos Auxiliares de Informática (TAI). Sirve para practicar preguntas y supuestos, preparar simulacros, repasar fallos con repetición espaciada y seguir el progreso por temas. Se puede instalar en móviles y tabletas y está diseñada para conservar el estudio sin conexión.

La aplicación combina un banco de preguntas de distintos orígenes —oficial, academia y generado— con tarjetas de repaso y herramientas para organizar el estudio. El origen del contenido se muestra para que se pueda valorar junto con cada respuesta.

> **Estado del proyecto:** `package.json` declara la versión 1.1.17. Las cifras del banco pueden cambiar al publicar contenido; consulta los índices de `public/data/` y `public/cards/` para conocer los datos incluidos en este checkout. El código y los datos locales no acreditan por sí solos el estado del despliegue ni el funcionamiento de una cuenta Firebase concreta.

## Contenido

- [Qué puedes hacer](#qué-puedes-hacer)
- [Cómo funciona la aplicación](#cómo-funciona-la-aplicación)
- [Arquitectura del código](#arquitectura-del-código)
- [Paquetes utilizados](#paquetes-utilizados)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Desarrollo local](#desarrollo-local)
- [Firebase y publicación](#firebase-y-publicación)
- [Datos y contenido](#datos-y-contenido)
- [Comprobaciones](#comprobaciones)

## Qué puedes hacer

Las funcionalidades se agrupan por el momento del estudio en que resultan útiles.

### 1. Elegir qué estudiar

- **Inicio:** continuar una sesión pendiente, iniciar una sesión rápida o abrir el repaso vencido; muestra un resumen de actividad y progreso.
- **Temario y temas vistos:** explorar los temas disponibles, marcar los que se están estudiando y consultar el progreso asociado.
- **Planificación diaria:** organizar una sesión con actividades de estudio, práctica y repaso; comenzar, continuar y guardar el avance por actividad. La planificación utiliza los temas declarados como vistos y las preferencias configuradas.
- **Sesión rápida:** propone una práctica breve combinando preguntas nuevas y repasos, con atención a los temas más débiles y a las preferencias de origen.

### 2. Practicar preguntas

- **Test por tema:** elegir tema, cantidad y orden; filtrar preguntas nuevas, aleatorias, falladas o dudosas y seleccionar su origen. Incluye corrección, explicación cuando está disponible y referencias al temario.
- **Práctica guiada:** navegar por preguntas pendientes. La respuesta puede quedar bloqueada; consultar la solución cuenta como blanco consultado.
- **Señales de estudio:** indicar confianza, marcar opciones descartadas y subrayar texto durante la práctica. Las explicaciones de código se muestran según el modo de estudio y no durante un simulacro activo.
- **Pregunta relámpago:** resolver una pregunta con prioridad para repasos, fallos y respuestas marcadas como suerte.
- **Detective de trampas:** reconocer trampas en un enunciado, con o sin opciones visibles; también permite practicar trampas concretas desde estadísticas.
- **Lectura atenta:** entrenar la lectura de enunciados y priorizar fallos relacionados con la velocidad. Las ayudas de lectura permiten resaltar palabras clave y frenar antes de responder.

### 3. Hacer simulacros

- **Parte 1:** configurar un simulacro completo, por examen oficial o por tema. La distribución por temas sigue la configuración de los exámenes disponibles.
- **Parte 2:** practicar supuestos prácticos cuando la configuración del simulacro lo permite.
- **Durante el examen:** usar cronómetro, pausar y reanudar, navegar entre preguntas y dejar respuestas en blanco. No se muestra la corrección hasta terminar.
- **Resultados y revisión:** consultar nota con penalización, aciertos, fallos y blancos; revisar respuestas y referencias permitidas.
- **Historial:** seguir la evolución de la nota, comparar intentos por tema y revisar tiempos, ritmo y resultados de simulacros.

### 4. Repasar y consolidar

- **Falladas:** buscar por texto, filtrar por tema, por lectura del temario y por racha. Cada pregunta muestra la respuesta y su referencia; se puede marcar si se ha repasado en el temario. Tres aciertos seguidos sacan la pregunta de esta lista; un nuevo fallo reinicia la racha.
- **Repaso de fallos:** las preguntas falladas vuelven a la cola en intervalos de 2, 5, 14, 30 y 60 días. El intento puntuado posterior al vencimiento completa la comprobación pendiente.
- **Tarjetas de repaso:** estudiar tarjetas curadas por tema y tarjetas creadas desde preguntas falladas. Elegir sesiones de 10, 20 o 30 tarjetas; las vencidas tienen prioridad y se intercalan por tema.
- **Valoración de tarjetas:** intentar recordar antes de revelar y marcar «Fallé», «Dudaba» o «Lo sabía». El calendario avanza con los aciertos; fallar o dudar vuelve a programar la tarjeta a corto plazo. Se pueden usar teclado y gestos compatibles.
- **Cobertura y referencias:** consultar nuevas, vencidas, en repaso y dominadas; ver referencias al revelar y avisar de errores del contenido.

### 5. Entender el progreso y gestionar la cuenta

- **Estadísticas:** acierto y actividad por tema, origen y tipo de trampa; evolución de sesiones, preguntas falladas y tiempos de respuesta.
- **Errores del banco:** enviar avisos desde una respuesta o sus resultados; revisar, resolver y exportar los avisos desde Ajustes.
- **Cuenta y accesos:** usar el modo disponible como invitado o iniciar sesión con Google. Las personas autorizadas pueden gestionar solicitudes y accesos desde la pantalla correspondiente.
- **Ayuda:** consultar las instrucciones de uso y orientación sobre las pantallas de estudio.
- **Sincronización:** con Firebase configurado, sincronizar progreso, sesiones, tarjetas, temas vistos, avisos, planificación y otros datos compatibles por cuenta.
- **Importar y exportar:** crear una copia de progreso, recuperar una copia anterior, gestionar el historial detallado y exportar tarjetas a Anki en texto tabulado. El análisis asistido se descarga como un único ZIP con manifiesto, informe y partes JSON; se prepara bajo petición y no envía datos automáticamente.
- **Preferencias:** elegir tema claro, oscuro o automático, tamaño de letra, fecha objetivo, temas de estudio y opciones de práctica.
- **Actualizaciones:** consultar la versión y aplicar una actualización de la PWA conservando la sesión en curso.

## Cómo funciona la aplicación

TAI es una PWA servida como aplicación estática. React presenta las pantallas; el router conserva rutas con hash; un service worker gestiona el shell y la caché offline. Las preguntas y tarjetas se cargan desde los datos del proyecto o desde la fuente configurada por la aplicación. La descarga para uso sin conexión prepara los contenidos disponibles y los guarda en la caché del navegador.

El progreso se escribe primero en el dispositivo para permitir el estudio sin red. La persistencia local conserva compatibilidad con los datos históricos y mantiene una copia de recuperación en IndexedDB. Cuando existe una cuenta con acceso y conexión, Firebase sincroniza los datos que contemplan las reglas de Firestore. La sincronización está aislada por cuenta; el funcionamiento local no depende de que la sincronización remota esté disponible.

## Arquitectura del código

El código de `src/` sigue una arquitectura por capas. Las dependencias apuntan hacia el dominio: las reglas de estudio no necesitan conocer React, el navegador ni Firebase.

```text
Pantallas React (features) ──> casos de uso y contratos (core/application, core/ports)
                                          ↑                    ↑
                                   reglas de estudio       adaptadores
                                   (core/domain)      (local, Firebase, HTTP, offline)
                                          └──────────────┬─────┘
                                                composición en app/
```

- **`src/core/domain/`:** entidades, modelos y reglas puras del estudio: progreso, selección, sesiones, planificación, intentos y repetición espaciada.
- **`src/core/application/`:** casos de uso y coordinación de operaciones del dominio.
- **`src/core/ports/`:** contratos que el núcleo necesita para leer el banco y guardar o sincronizar progreso.
- **`src/adapters/`:** implementaciones de esos contratos. `local/` adapta el almacenamiento existente y sus formatos históricos; `firebase/` gestiona acceso y sincronización; `http/` obtiene catálogos y contenido; `offline/` prepara y consulta cachés.
- **`src/features/`:** pantallas y lógica de presentación agrupadas por función: inicio, test, quiz, resultados, simulacros, tarjetas, fallos, estadísticas, planificación, entrenadores, ajustes, errores, accesos y ayuda.
- **`src/shared/`:** navegación, componentes compartidos, servicios de interfaz, presentación de preguntas y estilos comunes.
- **`src/app/`:** entrada React, rutas con hash, layouts, arranque y composición. Aquí se conectan las features con los casos de uso y adaptadores concretos.

Las features pueden reutilizar módulos de `shared/` y contratos o casos de uso de `core/`, pero no importarse entre sí. Los componentes y hooks de interfaz compartidos pertenecen a `shared/ui/`; la preparación de datos exclusiva para presentación, a `shared/presentation/`; las reglas y operaciones comunes independientes de React, a `core/domain/` y `core/application/`; y la traducción de DTO o formatos de persistencia, al adaptador correspondiente. Los controladores de interacción que solo usa una pantalla permanecen en su feature. `npm run check:architecture` detecta dependencias directas entre features.

La composición mantiene persistencia y servicios fuera de las pantallas. Las pantallas reciben servicios tipados mediante contratos compartidos y React Router las carga de forma diferida. `app-services-composition.ts` conecta esos contratos con los casos de uso y adaptadores. El helper DOM imperativo y el antiguo `legacy-router.ts` se retiraron; `legacy-store.ts` se conserva como adaptador de los formatos de progreso históricos para proteger los datos guardados mientras avanza su migración.

## Paquetes utilizados

### Dependencias de la aplicación

| Paquete              | Uso                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------- |
| `react`, `react-dom` | Interfaz y montaje de la aplicación.                                                   |
| `react-router`       | Rutas con hash, navegación y carga diferida de pantallas.                              |
| `firebase`           | Autenticación y servicios Firebase usados por la sincronización.                       |
| `idb`                | Acceso tipado a IndexedDB para copias y almacenamiento local.                          |
| `zustand`            | Estado compartido en memoria donde resulta útil para la interfaz.                      |
| `zod`                | Validar y normalizar datos externos o persistidos.                                     |
| `ts-fsrs`            | Programación FSRS de las tarjetas que usan este calendario.                            |
| `recharts`           | Gráficos de estadísticas y evolución.                                                  |
| `shiki`              | Resaltado de sintaxis en explicaciones de código, con lenguajes cargados bajo demanda. |
| `lucide-react`       | Iconos de la interfaz.                                                                 |

### Herramientas de desarrollo

- **Vite** y `@vitejs/plugin-react` para desarrollo y compilación.
- **TypeScript** y `typescript-eslint` para tipado y análisis del código.
- **ESLint**, `eslint-plugin-import`, `eslint-plugin-react-hooks` y `eslint-config-prettier` para reglas de calidad.
- **Vitest**, `jsdom`, `fake-indexeddb` y Testing Library para pruebas unitarias y de componentes.
- **Playwright** para recorridos de navegador y pruebas de interfaz.
- **Prettier** para formato consistente.
- **Firebase Rules Unit Testing** para comprobar reglas de Firestore con el emulador.

Las versiones y scripts están declarados en [`package.json`](package.json); `package-lock.json` fija el árbol instalado.

## Estructura del repositorio

```text
src/                 aplicación, dominio, adaptadores, pantallas y estilos
public/data/         índice y datos de preguntas y supuestos
public/cards/        tarjetas curadas e índice
public/               manifiesto, iconos, service worker y recursos estáticos
scripts/              compilación, validadores y comprobaciones de arquitectura
tests/                pruebas unitarias, integración, reglas y navegador
tools/                utilidades auxiliares
firestore.rules       reglas de acceso a Firestore
firebase.json         hosting y cabeceras de seguridad
```

## Desarrollo local

Se usa Node.js 24 (`.nvmrc`). Python 3 solo es necesario para regenerar los bancos y ejecutar sus herramientas Python.

```sh
npm ci
npm run dev
```

Vite muestra la dirección local, normalmente `http://127.0.0.1:5173`. Para compilar y servir la versión compilada:

```sh
npm run build
npm run serve
```

Comandos habituales:

```sh
npm run check:architecture  # límites entre capas y deuda arquitectónica
npm run lint                # ESLint
npm run typecheck           # TypeScript
npm test                    # Vitest
npm run test:e2e            # Playwright
npm run check               # arquitectura, lint, typecheck y Vitest
```

El build se genera en `dist/` y no se versiona. La aplicación local puede funcionar sin credenciales Firebase; las funciones de acceso y sincronización requieren la configuración del proyecto.

## Firebase y publicación

La configuración de Hosting está en `firebase.json`, las reglas en `firestore.rules` y el flujo de publicación en `.github/workflows/`. Para una instalación propia:

1. Crea un proyecto Firebase y una aplicación web; coloca la configuración web en `public/firebase-config.json` según el formato que espera la app.
2. Habilita Google Authentication y crea Firestore.
3. Revisa las reglas de `firestore.rules` y publícalas para el proyecto configurado. Las reglas limitan los datos privados a las cuentas permitidas por la política del proyecto.
4. Configura Firebase Hosting y las credenciales requeridas por el flujo de despliegue.
5. Publica Hosting y reglas mediante el proceso del repositorio. `npm run deploy` incluye validaciones, build y despliegue manual.
6. Para instalarla en iOS/iPadOS, abre el Hosting por HTTPS en Safari y usa **Compartir → Añadir a pantalla de inicio**. El inicio de sesión OAuth puede depender del dominio configurado en Firebase.

El CI valida el código y el contenido antes de publicar. Los resultados locales no demuestran que reglas, Hosting, OAuth o sincronización estén desplegados y operativos; eso requiere comprobar el servicio y la cuenta reales.

## Datos y contenido

- `public/data/` contiene el índice, metadatos, banco local y supuestos incluidos en el checkout. El código de origen identifica el contenido oficial (`O`), de academia (`A`) o generado (`G`). Las preguntas de academia pueden contener respuestas no oficiales y las provisionales se identifican en la interfaz.
- `public/cards/` contiene tarjetas curadas por tema. Las que llevan `revisar: true` quedan fuera del repaso y de la exportación hasta su revisión editorial.
- El generador `build_data.py` combina bancos originales y textos del temario, que se mantienen fuera del repositorio. Consulta `python3 build_data.py --help` para las rutas aceptadas. La compilación normal no requiere regenerar los datos.
- El validador `scripts/validate_cards.mjs` comprueba la estructura de tarjetas; la validación automática no certifica la exactitud editorial del contenido.
- Para exportar tarjetas a Anki se genera texto UTF-8 separado por tabuladores. El archivo contiene pregunta, respuesta, referencia y etiquetas; no incluye el calendario de repetición de TAI.

## Comprobaciones

`npm run check` es la verificación local principal y ejecuta comprobación arquitectónica, lint, typecheck y Vitest. Para los recorridos de navegador se usa `npm run test:e2e`; las reglas de Firestore tienen una suite de emulador mediante `npm run test:firestore-rules`.

Las pruebas de navegador con Chromium y WebKit emulados no sustituyen una prueba de instalación en un iPhone/iPad físico, VoiceOver, login real ni sincronización entre dispositivos. La comprobación del banco demuestra estructura y coherencia automatizable, no revisión humana de cada respuesta.

Más detalles de la composición visual están en [src/shared/styles/README.md](src/shared/styles/README.md), y las reglas y límites del plan diario en [src/features/planning/README.md](src/features/planning/README.md).

### Implementación de la auditoría Astra

La auditoría original conserva **16.078 dictámenes sobre 16.078 preguntas: cero IDs pendientes de revisión semántica**. Identificó3.519 incidencias editoriales. Los dictámenes originales permanecen inmutables; una pregunta auditada puede seguir pendiente de reparación.

Este checkout prepara **1.1.19**, con **405 reparaciones locales**, una revisión PHP que mantiene `np:1/w:1` y **ocho exclusiones de puntuación confirmadas que no cuentan como reparaciones**. Quedan **3.114 incidencias sin reparación factual definitiva, incluidas40 P0**. Cuatro de esas40 ya tienen `np:1` persistido; otras ocho reciben la nueva protección de código de esta entrega. Las restantes necesitan resolución documentada, sin convertir incertidumbre en una respuesta validada. El estado porID está en `tests/e2e/evidence/astra-implementation-2026-11-05/implementation-tasks.json`.

Última producción comprobada: **1.1.18+0f974e3**, [PR113](https://github.com/dramirodev/tai-oposicion/pull/113), despliegue oficial42205124709 correcto y siete comprobaciones de invitado sin errores ni escrituras. El banco sigue en **v15:300 reparaciones publicadas y PHP no puntuable**. La publicación233 autorizada se ejecutó desde M5 congelado3987188, tras CI112, mergeaeb4225 y despliegue42202392598; un commit con34 updatesCAS,105 tipos y cero borrados. La lectura independiente comprobó79 GET/77 SHA256 y preservó68 reparaciones anteriores. El cliente M5 con el snapshot leído aprobó300 actuales y bloqueó300 antiguas/300 mutadas en Chromium/WebKit. Tras PR113, otros79 GET confirmaron que los78documentos siguen exactamente iguales a la copia v15. No se accedió a datos de estudiantes.

La rama `fix/tai-editorial-wave5`, en worktree independiente, parte de mainaeb4225 e incorpora M6d243c06 mediante b2c35ba. Añade65 reparaciones sobre las 340 de PR113 y ocho protecciones de código. Las105 reparaciones posteriores a M5 NO están publicadas ni autorizadas para Firestore. Se preservan el checkout principal y el trabajo UX/PR110; no hay despliegues concurrentes.

| Manifiesto de scripts/bank-editorial | Modificaciones | Reparaciones | Muestras |
|---|---:|---:|---:|
| reviewed-web, reviewed-T3.08, reviewed-T4.07 |13|13 publicadas en v13|0|
| reviewed-19 |19|19 publicadas en v14|0|
| reviewed-followup |36|36 publicadas en v14; cinco recuperaciones|2|
| reviewed-wave2 |129|128 publicadas en v15; PHP sigue no puntuable|0|
| reviewed-admin20 |20|20 publicadas en v15|2|
| reviewed-legal19 |19|19 publicadas en v15|1|
| reviewed-programming20 |20|20 publicadas en v15|0|
| reviewed-web25 |25|25 publicadas en v15|0|
| reviewed-architecture20 |20|20 publicadas en v15|0|
| reviewed-languages17 |17|17 locales; dos en supuestos|0|
| reviewed-web23 |23|23 locales|0|
| reviewed-development11 |11|11 locales; una en supuestos|0|
| reviewed-systems20 |20|20 locales|1|
| reviewed-foundations18 |18|18 locales|0|
| reviewed-systems16 |16|16 locales|0|
| quarantines-reviewed8 |0 cambios de datos|0; ocho exclusiones de código|0|

Cada reparación conserva antes/después completos, huellas de transporte, cuatro racionales y referencia por página, pasaje y SHA. Los resúmenes se identifican como tales; las discrepancias del temario con fuentes primarias se declaran. No se presenta una cita errónea como prueba de la nueva clave. Se conservan IDs, familias, contextos, orígenes e historiales; las etiquetas D/I/C/K sólo modifican el índice2 del catálogo. Las 65 de esta entrega actualizan23 tipos y una muestra; conservan los340 registros aprobados anteriores.

El pipeline editorial utiliza los seis patrones demostrados por Astra, trazabilidad al temario, esquema, duplicados y revisión independiente. La confianza de IA no habilita puntuación. `bank_release.py` conserva39 archivos aprobados; el publicador valida77recursos y publica atómicamente conCAS. Se reutiliza el planificador; no se introducen predicciones sin datos para validarlas ni se cambian puntuaciones históricas.

### Puntuación y contenido verificado

La allowlist contiene **405 ID/SHA-256**, sin el texto privado del banco. Se verifica el registro completo antes de aplicar `np`; el dominio usa un puerto de hash y un Symbol privado ligado al JSON canónico de claves ordenadas. Enunciado, alternativas, clave, explicación, referencia, contexto y `np` quedan vinculados. El motor vuelve a comprobar la prueba al responder/corregir/calcular totales y los entrenadores comprueban el registro cargado. ID, versión, confianza o metadatos remotos no autorizan la nota.

Las tres correcciones AS12B-S1-04/09/R-04 permanecen anidadas en `supuestos.json`. El catálogo vincula `supTexto` completo, incluso vacío, y vuelve a comprobar el contexto después del digest. Las filas históricas ajenas conservan su forma. Un alias renombrado de un registro revisado no hereda su aprobación. Copias por spread intactas conservan prueba; JSON/DTO y mutaciones no. `np:1` prevalece y PHP no recibe huella aprobada. El helper de build rechaza rutas, symlinks, filas o campos adicionales, duplicados y deriva; las huellas raw, envolvente del caso y runtime se prueban por separado.

Las ocho exclusiones nuevas tienen dos firmas, before/SHA, fuentes y cuatro alternativas revisadas en `quarantines-reviewed8.json`; no añaden hashes aprobados, no modifican datos persistidos ni cambian claves oficiales. L2025A-P1-20 ya se excluía con reserva1 en el perfil oficial, pero podía puntuar en práctica general: ahora se protege también allí. El caso SQL extraordinario conserva todo su contexto. Otros17 casos con evidencia insuficiente no se convierten automáticamente en cuarentena; la reserva oficial ya marcada `np:1` permanece igual.

Falladas carga antes de filtrar; tarjetas proyecta avisos desde contenido probado. Las no puntuables no escriben respuestas o estadísticas puntuables ni entran en el denominador. La reanudación comprueba UID, permiso y revisión. El perfil2025A conserva80 teóricas+20 de un caso, reservas, baremos separados y120 minutos absolutos desde abrir el cuaderno. Los históricos previos permanecen inmutables.

### Reproducción, pruebas y publicación

```sh
node scripts/bank-editorial/generate-content-hashes.mjs
npm run check
npm run test:editorial
npm run build
```

Replay opera sólo sobre copias externas, con preflight completo, bloqueo, rechazo de deriva/symlinks y recuperación parcial. Para revertir las 65 de esta entrega, preparar las copias de los archivos enumerados por los cuatro manifiestos, con su directorio sample, y ejecutar:

```sh
python3 scripts/bank-editorial/replay.py --candidate-dir RUTA --batch reviewed-systems16 --include-sample --rollback
python3 scripts/bank-editorial/replay.py --candidate-dir RUTA --batch reviewed-foundations18 --include-sample --rollback
python3 scripts/bank-editorial/replay.py --candidate-dir RUTA --batch reviewed-systems20 --include-sample --rollback
python3 scripts/bank-editorial/replay.py --candidate-dir RUTA --batch reviewed-development11 --include-sample --rollback
```

Aplicar en orden inverso con `--apply`. Las pruebas reconstruyen las fronteras históricas sin cambiar sus SHA originales. Esto no escribe Firestore. Las ocho exclusiones se revierten mediante un cambio de código revisado y el pipeline habitual, sin borrar preguntas.

Validación local final: arquitectura, lint y tipos correctos; **1.066 unitarias aprobadas/29 omitidas,61 pruebas Python y build1.1.19 correcto**. Las 65 preguntas se renderizan a393/1280px en Chromium/WebKit,100 bloques de código por vista,2/2. Se prueban405 contenidos aprobados con sus predecesores, seis muestras, tres casos anidados y ocho nuevas exclusiones; motor, nota/denominador, UID, checkpoint, historial, perfil100/reservas y ausencia de escrituras de respuestas protegidas. Los oráculos distinguen ejecución real y modelos: no se afirma runtime Oracle, SQLServer, .NET, GNUfind, Windows o protocolos que no se hayan ejecutado.

AT309-P1-12 y GEN-T3.08-418.v1 sólo retiran `np` en sus redacciones corregidas con prueba exacta. El fixture de consulta histórica carga el before real de AT309, muestra el enunciado antiguo y su aviso vigente, desactiva opciones y comprueba que no guarda nota, estadísticas ni sesión. Los fallos anteriores por usar la edición actual como histórica se corrigieron sin relajar esas garantías. Se conservan las correcciones de montaje act/Home y de espera de checkpoint/pausa; no se desactivan aserciones ni se aumentan tiempos para ocultar fallos.

CI113 terminó correctamente:1.058 unitarias/29 omitidas,45 Python,Auth/Firestore/publicación concurrente,dosAuthUI,76 referencias y260 E2E/4 omitidas; despliegue42205124709 y postsmoke7/7 correctos. Esta rama ejecuta su propia CI antes del merge. Las pruebas en emuladores no certifican OAuth productivo, VoiceOver o dispositivos físicos. Se conservan las advertencias preexistentes de scrollTo/jsdom y tamaño de chunks. Los diagnósticos WebKit de sincronización se documentan separados de errores/rechazos JS; no se presenta la clasificación por documento como cero diagnósticos.

La autorización de233 está cumplida y sus recibos quedan en [publication233-v15.json](tests/e2e/evidence/astra-implementation-2026-11-05/publication233-v15.json), [verificación completa](tests/e2e/evidence/astra-implementation-2026-11-05/publication233-v15-verification.json) y [cliente300](tests/e2e/evidence/astra-implementation-2026-11-05/publication233-v15-client.json). El lote siguiente de105 necesita plan reproducible, copia v15, autorización específica, CI/merge/despliegue y lectura posterior; no se amplía la autorización anterior. Hosting no ejecuta el publicador del banco privado. Después de otras publicaciones no restaurar archivos completos antiguos sin preservar los cambios intermedios; cualquier rollback de datos requiere CAS y una nueva versión creciente.

README, los PR107/108/109/111/112/113 y `tests/e2e/audit-findings.md` conservan la trazabilidad de integración. La misión sigue parcialmente completada por las reparaciones, publicaciones y verificaciones pendientes.

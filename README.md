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

### Handoff de E2E autenticado (2026-11-04)

`npm run test:e2e:firebase-auth` ya cubre el aislamiento entre dos cuentas del Auth Emulator y el uso de Firestore Emulator. El error observado era una expectativa ligada a `nth(1)`: la actividad prioritaria seguía presente, pero el test variado ocupaba esa posición. Se corrigió la búsqueda por título/tema y se cerró la salida de red del navegador salvo app/emuladores locales y recursos GET estáticos `apis.google.com` usados por el popup OAuth simulado. La prueba exige conexiones a `:9099` y `:8080`. Pasó en Chromium; WebKit se omite deliberadamente.

La integración Agentic Test Explorer quedó preparada en `scripts/e2e/` y `tests/e2e/missions/`: crea sesión sintética del Auth Emulator preservando IndexedDB, bloquea destinos externos y service workers en el navegador explorador y ejecuta sólo Auth/Firestore Emulator con `demo-tai-auth`. La misión queda pendiente de ejecución: el entorno observado ofrece Python 3.9 frente al mínimo 3.11 del PoC y no tiene proveedor LLM configurado. No se realizaron llamadas al proveedor.

El diagnóstico, los pasos de cuentas ficticias y la integración preparada con Agentic Test Explorer están en [tests/e2e/README.md](tests/e2e/README.md). Su misión no se ejecutó aquí porque el Python disponible es 3.9 y no hay credenciales de proveedor LLM configuradas.

### Handoff de usuario sintético exclusivo de emuladores (2026-11-04)

La preparación reutilizable, la matriz de permisos y los comandos autónomos están en [tests/e2e/README.md](tests/e2e/README.md#propietario-sintético-y-matriz-de-autorización-2026-11-04). `npm run test:e2e:supertest` ejecuta propietario, aprobado, restringido, pendiente y anónimo con `demo-tai-auth`; Explorer usa la misma preparación. No se añaden custom claims: el sistema usa propietario por correo verificado y aprobaciones por documento. Las reglas productivas se conservan; una copia temporal sustituye únicamente la identidad del propietario. El SDK Admin se limita a preparar/restablecer datos ficticios. Se preservan los cambios locales preexistentes y el informe de planificación sin versionar.

Validación de esta fase: `npm run test:e2e:supertest` terminó con **6/6** en Chromium (incluye persistencia remota con token del navegador, gestión de accesos y matriz negativa de reglas); preparación de Explorer con `TAI_EXPLORER_PREPARE_ONLY=1` terminada correctamente sin invocar al proveedor. Arquitectura, lint, typecheck, build y diff-check correctos. `npx vitest run --maxWorkers=2`: **952 aprobadas, 27 omitidas**. `npm run check` con el paralelismo predeterminado mostró un fallo intermitente de `design-flow.test.js`; la suite completa con dos procesos pasó. Las dos expectativas de Planificación que dependían del día real se corrigieron declarando enfoque de contenido nuevo en sus fixtures. Continúan los avisos conocidos de Rollup/Zod y tamaño de chunks.

Pendiente: ejecutar la misión autónoma con Gemini únicamente tras autorización explícita del envío de capturas/estado sintéticos. La revisión automática rechazó ese lanzamiento; no hubo llamada al proveedor. La preparación local y sesión exportada sí están verificadas. Las entradas a todos los módulos no equivalen a cobertura exhaustiva de sus operaciones; ampliar misiones y convertir hallazgos reproducibles en pruebas deterministas sigue siendo la siguiente fase. No se hizo commit, push ni despliegue. Los cambios concurrentes de `tests/e2e/css-ui.spec.ts` se dejaron intactos.

### Handoff de Explorer ejecutado y hallazgos reproducidos (2026-11-04)

El usuario autorizó expresamente el envío a Gemini de capturas/estado sintéticos y se ejecutó la exploración exclusivamente con `demo-tai-auth`. El [informe de misión y revisión](tests/e2e/explorer-mission-2026-11-04.md) distingue candidatos, evidencia y cobertura real. Se aislaron memoria/sesión/informes por pasada y se corrigió la duplicación de historial del adaptador del explorador. Dos candidatos de navegación resultaron ser selectores inventados; no se cambiaron las rutas de TAI para aceptarlos.

Se reprodujeron y corrigieron dos defectos de TAI: espera circular entre la ruta protegida y el arranque de Auth al recargar, y navegación antigua del shell que cancelaba el retorno a Inicio durante logout. Las pruebas fallaron antes y pasan después. Se conservan los guardas y el contenido protegido permanece oculto hasta resolver permisos. Verificación final: `npm run check` **957/27 skip**, supertest **7/7 Chromium**, journey Auth **1 passed/1 WebKit skipped**, regresión offline Explorer **1/1** y contexto del clon **9/9**; build y diff-check correctos. Sin commit/push/deploy.

La misión LLM quedó parcial tras tres rechazos 429 de Gemini; las cintas registran siete áreas en la última pasada y no se afirma exploración exhaustiva. Próximo paso: repetir al recuperarse cuota con la autorización ya concedida y revisar nuevos candidatos antes de modificar TAI. Los resultados previos sobre falta de autorización/entorno de Explorer son históricos y quedan actualizados por este corte.

### Implementación de la auditoría Astra

La auditoría original conserva **16.078 dictámenes sobre 16.078 preguntas: cero IDs pendientes de revisión semántica**. Identificó 3.519 incidencias editoriales y 437 P0. Sus diez informes y dictámenes permanecen inmutables. Auditar una pregunta no equivale a haber reparado su contenido.

Hay **405 reparaciones publicadas y verificadas en Firestore v16**, además de PHP `GEN-T3.03-48` mejorada pero todavía `np:1/w:1`. El usuario autorizó las 105 últimas y la autorización está cumplida: publicación de 2026-11-06T12:29:56Z, un commit con 27 actualizaciones CAS, 54 ajustes de tipo, tres filas anidadas y cero borrados. La lectura independiente comprobó 79 GET, 77 SHA-256, 300 reparaciones anteriores preservadas y los ocho datos de cuarentena intactos. El cliente real `getQuestions` con ese snapshot, en Chromium y WebKit, verificó 405 actuales y bloqueó 405 antiguas, 405 mutadas y 405 serializadas; PHP y las ocho exclusiones siguen sin puntuar. No se accedió a datos de estudiantes ni se certifica OAuth productivo con ese ensayo local.

La cadena verificable es [PR114](https://github.com/dramirodev/tai-oposicion/pull/114), fuente congelada `4bafb543270da6a869b10d2bb85c062b0772ba4d`, CI 42213356673, merge `06b8dc67ae1a6656685eb1b33da2305dc9db0364`, despliegue oficial 42216440061 y siete comprobaciones de invitado sin errores ni escrituras. Recibos: [publicación](tests/e2e/evidence/astra-implementation-2026-11-05/publication105-v16.json), [lectura completa](tests/e2e/evidence/astra-implementation-2026-11-05/publication105-v16-verification.json), [cliente](tests/e2e/evidence/astra-implementation-2026-11-05/publication105-v16-client.json) y [CI/despliegue](tests/e2e/evidence/astra-implementation-2026-11-05/publication105-v16-ci-deployment.json). No volver a pedir ni ejecutar las autorizaciones de 13, 55, 233 o 105.

Este checkout prepara **1.1.20**, con **408 reparaciones verificadas localmente: 405 publicadas y tres nuevas aún no autorizadas ni publicadas**. Quedan **3.111 incidencias sin reparación factual definitiva, incluidas 37 P0** en el estado local; el banco productivo conserva 3.114/40 hasta publicar las tres. Cuatro de las 37 ya tienen `np:1` persistido y otras ocho tienen exclusiones de código desplegadas: son mitigaciones, no reparaciones. No se descartan hallazgos para reducir cifras. El registro por ID es [implementation-tasks.json](tests/e2e/evidence/astra-implementation-2026-11-05/implementation-tasks.json).

El worktree `tai-editorial-wave6`, rama `fix/tai-editorial-wave6`, se creó desde main `06b8dc6` y avanzó por fast-forward a `c38058d` tras integrarse PR110 de UX. Conserva sus cambios y controles de CI. El checkout principal y las fuentes editoriales anteriores permanecen intactos. El despliegue UX se comprueba antes de integrar otra entrega; no se hacen publicaciones concurrentes.

| Manifiesto de scripts/bank-editorial | Modificaciones | Estado |
|---|---:|---|
| reviewed-web, reviewed-T3.08, reviewed-T4.07 |13|13 reparaciones publicadas v13|
| reviewed-19, reviewed-followup |55|55 reparaciones publicadas v14; cinco recuperaciones|
| reviewed-wave2 |129|128 reparaciones y PHP no puntuable, publicadas v15|
| reviewed-admin20, reviewed-legal19, reviewed-programming20 |59|59 reparaciones publicadas v15|
| reviewed-web25, reviewed-architecture20 |45|45 reparaciones publicadas v15|
| reviewed-languages17, reviewed-web23 |40|40 reparaciones publicadas v16; dos anidadas|
| reviewed-development11, reviewed-systems20 |31|31 reparaciones publicadas v16; una anidada|
| reviewed-foundations18, reviewed-systems16 |34|34 reparaciones publicadas v16|
| reviewed-syntax3 |3|Tres nuevas reparaciones locales, sin autorización de datos|
| quarantines-reviewed8 |0 cambios de datos|Ocho exclusiones desplegadas, no reparaciones|

Las tres nuevas reparaciones conservan alternativas, claves, IDs, familias, contextos, orden y orígenes: `AS12B-S2-08` elimina un espacio que dividía el modo chmod; `L2019-S1-08` corrige Function a function; `L2025X-S1-04` normaliza la elipsis a tres puntos y precisa el ámbito de método. Sólo cambian enunciado, explicación y referencia. Los originales, el temario y las cuatro alternativas se comprobaron individualmente. El manifiesto conserva antes/después, hashes raw y contextuales, página/pasaje/SHA y límites. Son erratas mínimas demostradas mediante ejecución real; no se atribuye una nueva firma de otro modelo, cuya cuota está agotada, ni se aprueban casos semánticos inciertos por confianza de IA.

### Puntuación y contenido verificado

La allowlist contiene **408 ID/SHA-256**, sin texto privado del banco. Se verifica el registro completo antes de aplicar `np`; el dominio usa un puerto de hash y un Symbol privado ligado al JSON canónico de claves ordenadas. Enunciado, alternativas, clave, explicación, referencia, contexto y `np` quedan vinculados. Motor y entrenadores vuelven a comprobar la prueba. ID, versión, confianza o metadatos remotos no autorizan la nota.

Hay seis filas anidadas aprobadas localmente, tres ya publicadas. `supTexto` se vincula completo, incluso vacío, y se comprueba otra vez después del digest. Las demás filas conservan su forma. Alias renombrados, JSON/DTO o mutaciones no heredan aprobación. `np:1` prevalece: PHP nunca recibe hash. Build rechaza rutas, symlinks, campos adicionales, duplicados y deriva. Se prueban por separado transporte raw, envolvente del caso y hash canónico runtime.

Las ocho exclusiones de `quarantines-reviewed8.json` conservan dos firmas, before/SHA y cuatro alternativas revisadas. No modifican datos ni claves. L2025A-P1-20 sigue sustituida por reserva1 en el perfil oficial y bloqueada también en práctica general. El caso SQL extraordinario conserva su contexto. Otros 17 casos sin evidencia concluyente no se excluyen automáticamente.

Falladas carga antes de filtrar y tarjetas proyecta avisos desde contenido probado. Las no puntuables no escriben respuestas o estadísticas puntuables ni entran en el denominador. Reanudar comprueba UID, permiso y revisión. El perfil2025A conserva 80 teóricas +20 de un caso, reservas, baremos separados y 120 minutos absolutos. Los históricos permanecen intactos. El generador conserva los seis patrones demostrados por Astra, trazabilidad al temario, esquema, duplicados y revisión independiente; no sustituye al planificador ni añade predicciones sin datos.

### Reproducción, pruebas y publicación

```sh
node scripts/bank-editorial/generate-content-hashes.mjs
npm run check
npm run test:editorial
npm run build
```

Validación local ejecutada: arquitectura, lint, tipos y **1.083 unitarias aprobadas/29 omitidas**, **67 pruebas Python**, build **1.1.20** y tarjetas correctos. Las tres preguntas pasan el renderizado de texto, código, accesibilidad y overflow a 393/1280px en Chromium/WebKit: dos recorridos, 27 bloques por vista. Se ejecutaron Node24, TypeScript5.9.3 y chmod nativo macOS; la ejecución GNU/Linux queda para CI, sin atribuirla al ensayo BSD. Los 405 registros anteriores y PHP conservan sus SHA exactos, los 417 registros de supuestos mantienen orden y contexto y no cambia el catálogo o las seis muestras.

La primera suite tras incorporar UX detectó una dependencia local ausente y un fixture de simulacro que omitía la verificación de contenido de L2019. Se instalaron dependencias exactas propias del worktree y el fixture utiliza la verificación contextual real, manteniendo todas sus comprobaciones de parejas, reservas y baremos. Una nueva regresión bloquea el before histórico con el mismo ID. No se silencian pruebas ni se alteran reglas para aceptar datos sin prueba. Se conservan advertencias de jsdom/scrollTo y tamaño de chunks. Las pruebas locales no certifican OAuth productivo, dispositivos físicos o VoiceOver.

Replay opera sólo sobre copias externas, con preflight completo, bloqueo, rechazo de deriva/symlinks, idempotencia y rollback byte a byte. Para revertir estas tres, copiar `supuestos.json` a una carpeta candidata externa y ejecutar:

```sh
python3 scripts/bank-editorial/replay.py --candidate-dir RUTA --batch reviewed-syntax3 --rollback
```

Reaplicar con `--apply`. Las fronteras históricas se reconstruyen revirtiendo sucesores sin modificar sus SHA. Esto no escribe Firestore. `bank_release.py` conserva 39 archivos aprobados y el publicador valida 77 recursos con CAS. Los JSON privados pueden estar en dist local: Hosting los excluye por `hosting.ignore`; no confundir dist con los recursos publicados. Las ocho exclusiones se revierten con código revisado y el workflow habitual, sin borrar preguntas.

Siguiente paso: CI de la cabeza final, integración y despliegue oficial seguros, comprobación productiva sin alumnos reales, y preparación del lote de tres contra copia v16 con autorización específica nueva. Hosting no publica automáticamente el banco. Rollback de código mediante revert y workflow oficial; cualquier reversión de datos necesita CAS, versión creciente y preservar cambios intermedios. La misión sigue parcialmente completada por las 3.111 reparaciones locales pendientes y la publicación del nuevo lote. El registro compartido conserva el historial en `tests/e2e/audit-findings.md`.

# TAI · Preparación de oposiciones

TAI es una aplicación web progresiva (PWA) para preparar las oposiciones del cuerpo de Técnicos Auxiliares de Informática (TAI). Sirve para practicar preguntas y supuestos, preparar simulacros, repasar fallos con repetición espaciada y seguir el progreso por temas. Se puede instalar en móviles y tabletas y está diseñada para conservar el estudio sin conexión.

La aplicación combina un banco de preguntas de distintos orígenes —oficial, academia y generado— con tarjetas de repaso y herramientas para organizar el estudio. El origen del contenido se muestra para que se pueda valorar junto con cada respuesta.

> **Estado del proyecto:** `package.json` declara la versión 1.1.15. Las cifras del banco pueden cambiar al publicar contenido; consulta los índices de `public/data/` y `public/cards/` para conocer los datos incluidos en este checkout. El código y los datos locales no acreditan por sí solos el estado del despliegue ni el funcionamiento de una cuenta Firebase concreta.

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

**Continuación 1.1.15 (corte local):** 36 reparaciones revisadas en once temas y dos copias de muestra. Incluye 31 P0 y la recuperación accesible de cinco materiales originales. Se conserva la cuarentena de esas cinco hasta publicar y verificar su contenido: disponer del texto local no habilita la versión antigua que permanece en Firestore. El lote anterior de 19 sigue sin publicar; la revisión automática exigió autorización literal y se ha solicitado, sin respuesta en este corte. Producción comprobada: código 1.1.14+d3e29bf y banco v13 con 13 correcciones autorizadas. El PR de continuación mantendrá los resultados de CI, integración y despliegue. La preparación del plan único de 55 cambios (19 anteriores + 36 nuevos) realizó 17 lecturas y cero escrituras; el publicador preparado requiere autorización literal, 17 precondiciones y un commit atómico sin borrados.

El manifiesto `scripts/bank-editorial/reviewed-followup.json` conserva los 36 registros antes/después, huellas de archivos y preguntas, páginas/pasajes y las 144 justificaciones de alternativas. Las imágenes originales se usaron sólo como evidencia local; el banco integra transcripciones accesibles. AS09-P1-48 se reformula sobre cursivas y clases abstractas, con clave A, evitando dar por válida una interpretación ambigua de `{leaf}`. DNS se reformula al límite de etiqueta ASCII de 63, coincidente en temario y RFC, y no convalida la afirmación original de 255 caracteres. Cambios de enunciado, alternativas y clave invalidan guardados incompatibles mediante la revisión existente; IDs e historiales se conservan.

Se revisan además las etiquetas D/I/C/K contra sus definiciones existentes:28se actualizan tanto en las preguntas como en meta.json. Sólo cambia el campo de tipo de esos28registros del catálogo; orígenes, trampas, dificultad, familias, IDs e índices se conservan. La publicación necesitará también el documento de catálogo, además de los15temas del plan55 y bank/meta; no añade preguntas.

La reproducción y reversión del lote usan `python3 scripts/bank-editorial/replay.py --batch reviewed-followup --candidate-dir RUTA --apply` o `--rollback`, siempre sobre copia externa. Para incluir las dos copias de muestra, copiar además sus archivos a `RUTA/sample` y añadir `--include-sample`: se verifican todos los archivos antes de escribir, se rechaza deriva o enlaces simbólicos y se admite recuperación de estados parciales. La suite histórica de 19 reconstruye su propia frontera revirtiendo primero este sucesor en temporales.

El corte local completo contiene 68 reparaciones (13 + 19 + 36); quedan 3.451 incidencias editoriales sin reparar, incluidas 377 P0. La revisión semántica original está completa: 16.078/16.078 dictámenes y cero IDs pendientes de auditar. Son cifras distintas de la publicación: Firestore sigue en v13 con sólo 13 reparaciones publicadas. Las cifras de los apartados históricos siguientes corresponden a sus respectivos cortes.

Validación conjunta del código de contenido, entrada fría y tarjetas: arquitectura, lint y tipos correctos, 1.032 pruebas aprobadas y 29 omitidas; catorce pruebas editoriales; build 1.1.15 correcto. Las 36 preguntas se renderizaron en Chromium/WebKit, a 393/1280 píxeles, con cuatro alternativas y 34 bloques de código por vista, sin pérdidas ni desbordamiento. El PR 109 conserva las comprobaciones de CI y la integración de esta cabeza; una ejecución anterior sobre 987108c falló en dos recorridos WebKit y no se considera validación final.

Se corrige también la ausencia de key de Fragment en ramas transparentes de StudyMarkup, con regresión de renderizado; no cambia el filtrado de HTML. Las pruebas de sincronización adicionales usan tres contextos y cuentas sintéticas en emuladores. WebKit presenta diagnósticos de transporte de Firestore 10.14.1 al descargar el documento anterior durante reload: se reprodujeron sin React, sin error/unhandledrejection del documento nuevo y con sincronización restaurada. La prueba estricta registra 3/4 en app y 4/6 en SDK; la clasificación por documento da 6/6. Esto no certifica cero diagnósticos de navegador, OAuth de producción, VoiceOver ni dispositivos físicos. No se cambia el SDK ni su transporte.

El registro operativo está en [tests/e2e/audit-findings.md](tests/e2e/audit-findings.md). La auditoría original, sus 3.519 tareas y la procedencia se conservan en `tests/e2e/evidence/astra-implementation-2026-11-05/`. El [pipeline de candidatos](tools/question-editorial/README.md) conserva patrones oficiales y exige evidencia por documento y página y una revisión independiente de la propuesta. El manifiesto `scripts/bank-editorial/release.json` protege las claves, exclusiones y correcciones de la edición revisada al reconstruir y publicar.

La implementación se realiza en `feat/tai-audit-implementation`, worktree `/Users/dramiro/Documents/Codex/tai-audit-implementation`, desde `origin/main` `6b8ce24`. El checkout principal contiene otra auditoría en curso y se conserva. La herramienta de worktrees de la app quedó sin respuesta, y se creó el aislamiento con Git tras comprobar que no había creado ningún directorio.

La publicación de código usa el PR y el workflow `Desplegar en Firebase` después de las validaciones. Las modificaciones reales del banco en Firestore requieren una autorización específica y no se incluyen implícitamente en ese despliegue. Reversión de código mediante commit de revert y pipeline habitual. Firebase Hosting también permite seleccionar una release anterior desde la consola. Los parches editoriales locales conservan huellas antes/después y admiten replay inverso.

El nuevo perfil de ingreso libre 2025 reproduce el modelo A definitivo, con 80 preguntas de conocimientos (reserva activada por anulación) y 20 del supuesto elegido entre los bloques III/IV. Abrir el cuaderno inicia el plazo absoluto de 120 minutos, incluida la lectura y el tiempo con la app cerrada. Se conserva al recargar y se impide la pausa del reloj oficial. La calificación aplica los cortes publicados para sistema general y norma común 13 y muestra cada parte por separado. Las prácticas configurables conservan su configuración propia.

La selección ponderada reserva una familia distinta por tema cuando hay plazas y candidatos suficientes y completa el reparto según pesos. El problema acotado a los temas del banco se resuelve sobre las estructuras y RNG existentes. Una biblioteca adicional de optimización aportaría una API y dependencia para un emparejamiento pequeño y verificable; se conserva la solución local con pruebas de factibilidad y reparto.

Validación local 1.1.13: `npm run check` aprobó arquitectura, lint, tipos y 1.004 pruebas (29 omitidas). El pipeline editorial pasó nueve pruebas. Auth/Firestore Emulator pasó 1/1 y las reglas 27/27. La aceptación de sesión y examen pasó 10/10 en Chromium/WebKit. La medición de selección recorrió 1.600 simulacros y 96.000 posiciones, con los 36 temas y sin duplicar familias en todas las formas. Las 13 correcciones editoriales locales tienen transformación y reversión por huella, y cinco preguntas sin material esencial quedan solo como consulta. Continúan 3.501 incidencias editoriales pendientes, incluidas 427 P0.

Se revisaron las cuatro capturas móviles de Simulacros (claro/oscuro y Chromium/WebKit) para el cambio intencional de pestañas. La referencia visual consolidada se fija a 282f6921c79517bcefdd7617048d30794d0eb5da, que contiene la implementación y la redirección vigente de /cards. Las aserciones funcionales permanecen activas.

El publicador utiliza un único commit REST de Firestore para archivos y metadatos, con precondición sobre updateTime. Una publicación concurrente obsoleta se rechaza completa. Se prueban límites de tamaño y número de escrituras antes del POST y reintento sin cambios. La prueba de concurrencia real usa exclusivamente demo-tai-bank-atomic en loopback y está incluida en CI y despliegue. [Commit REST](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit) · [Precondición](https://firebase.google.com/docs/firestore/reference/rest/v1/Precondition).

CI detectó además una carrera de reset y recuperación local. La corrección añade una generación de la copia local por cuenta para impedir que reaparezcan datos del espejo anterior al borrar y recargar rápidamente. Se conserva el contrato de exportación/sincronización. El caso determinista y diez repeticiones de las suites de almacenamiento y navegación verifican la recuperación de datos nuevos y el rechazo de la copia anterior.

La reconstrucción de referencias detectó que la prueba del alias /cards esperaba la antigua pantalla de tarjetas. Se actualizó para comprobar su redirección a Inicio y el encabezado Hola y se revisaron las cuatro capturas claro/oscuro en ambos motores. La referencia se fija a 282f6921c79517bcefdd7617048d30794d0eb5da con las aserciones de URL, contenido y errores intactas.

La suite completa de WebKit reprodujo selectores invisibles durante el arranque. Se reutilizó el arreglo estable ac71bea3 para esperar dos fotogramas antes de mostrar la aplicación, con cancelación al desmontar. Pasaron 12 E2E y la suite general de 996 pruebas con 29 omitidas. Las cuatro capturas de Planificación coinciden byte por byte con la referencia 282f692. Se conserva la espera de comprobación de Firebase. [Registro de WebKit](https://bugs.webkit.org/show_bug.cgi?id=326092).

La prueba de navegador con Firebase Auth real en emuladores detectó una recarga protegida que podía redirigir antes de resolver identidad y permiso, borrar el checkpoint y competir con el cierre de sesión. Se espera una decisión de acceso, se conserva el guardado ante permisos pendientes o fallos de red y se elimina la navegación hacia una ruta capturada antes del logout. Una prueba Chromium con usuario ficticio, SDK Auth y Firestore locales comprueba los 100 IDs, respuestas y plazo del simulacro después de una recarga sin caché de permisos, y la ausencia de contenido privado después del logout. Está incluida como gate del PR, además de las pruebas de reglas y persistencia.

El usuario autorizó expresamente publicar exactamente las 13 correcciones preparadas, después de CI e integración; no se extiende a otras propuestas. La copia recuperable y las precondiciones de los tres documentos protegen la publicación. El [PR 107](https://github.com/dramirodev/tai-oposicion/pull/107) mantiene el handoff de integración y despliegue con commit final, workflow, verificación de Hosting y readback del banco; su estado debe consultarse antes de repetir una publicación.

El runner de referencias incluía todas las pantallas salvo Planificación; en Linux no existían esos PNG previos y fallaban las cuatro comparaciones. Se incluye esa ruta en la generación contra 282f692. Se conserva la referencia aprobada y el umbral visual.

TEC-12: la revocación confirmada del permiso retira el intento privado activo sin cerrar sus intentos ni añadir puntuación. Conserva el checkpoint por UID y separa la muestra pública con un marcador opcional compatible y clave propia para no sobrescribirlo. Al recuperar el permiso puede reanudar el mismo intento y plazo; si sigue una muestra activa, se conserva para la reanudación normal al recargar. Los casos históricos guardan IDs y revisión de contexto, recuperando su texto del catálogo. La prueba real Auth/Firestore en Chromium verifica revocar, practicar la muestra, reconceder y cerrar sesión. La suite final pasó 1.004 pruebas y 29 omitidas, además del build. El test de vacaciones fija su fecha de referencia para no depender del día de ejecución.

El recorrido heredado de Auth buscaba el refuerzo en la segunda posición, aunque el planificador lo prioriza primero. La traza confirmó T1.02 y la valoración en papel correcta. Se reutiliza la aserción por título del commit estable ac71bea3, conservando tema, valoración, fecha, logout y segunda cuenta sin progreso ajeno. La configuración Auth dedicada incluye ahora ambos escenarios para que CI compruebe también cambio de cuenta y de día. El primer despliegue está registrado en el PR 107: merge 004e818, workflow 42129565243, Hosting 1.1.13+004e818 y banco v13 con las 13 correcciones autorizadas y lectura posterior completa.

El seguimiento de CI confirmó una precondición ausente en la prueba de cierre desde el mapa: el motor ya estaba en la tercera pregunta, pero React aún pintaba el botón Siguiente de la primera. El test espera ahora selección/paso/Terminar y respuesta efectiva antes de finalizar, conservando las aserciones de cancelar/confirmar. No aumenta timeouts ni modifica producto. Caso 26 veces y archivo cuatro veces correctos; check completo 1.004 aprobadas/29 omitidas.

La prueba offline con service worker real prepara ahora la configuración sintética y el catálogo de supuestos antes de desconectar, espera su almacenamiento y los comprueba tras recargar sin red. Conserva el filtro de solicitudes fallidas y pasó tres ejecuciones por motor. El seguimiento conjunto de pruebas y contenido se registra en el [PR 108](https://github.com/dramirodev/tai-oposicion/pull/108).

### Lote editorial 1.1.14

La edición local prepara 19 correcciones adicionales sobre el banco de la versión 1.1.13. Los archivos modificados corresponden a T3.03 (6), T3.04 (4), T3.07 (1), T3.08 (6) y T4.08 (2). El manifiesto recoge las filas anteriores y propuestas, las 76 justificaciones de opciones y las páginas del temario. AT303-P1-09 conserva la clave D de academia y explica por qué el bucle corregido imprime nueve valores. GEN-T4.08-20.v1 sigue pendiente de resolver la contradicción documental. [Manifiesto y procedencia del lote](scripts/bank-editorial/reviewed-19.json)

Para reproducir las 19 soluciones, ejecute `npm run test:editorial` con Python 3, un JDK completo y Ruby. Para comprobar la reversión, copie los cinco JSON a un directorio temporal externo al checkout y ejecute `python3 scripts/bank-editorial/replay.py --batch reviewed-19 --candidate-dir RUTA --rollback`. La opción `--apply` recupera la edición propuesta. El lote se encuentra pendiente de autorización específica para Firestore.

El registro derivado distingue 13 correcciones publicadas y verificadas en banco v13, cinco mitigaciones por exclusión con material aún pendiente y 19 correcciones locales P0 pendientes de CI, autorización y publicación. Quedan 3.482 incidencias sin resolver ni proteger en esta edición local (408 P0); en producción siguen pendientes de publicar estas 19, por lo que allí permanecen 3.501 sin resolver ni proteger (427 P0). El plan específico es `tests/e2e/evidence/astra-implementation-2026-11-05/publication-plan-19.json`; no amplía la autorización anterior de 13. La auditoría original permanece íntegra.

Los estados del registro derivado describen el corte del commit. La recepción y el estado real de las publicaciones se mantienen en los PR 107/108 enlazados y en sus comprobantes, para distinguir una corrección local de una publicada. La preparación del lote 19 se aisló en un segundo worktree desde 004e818; la herramienta administrada volvió a quedar sin respuesta y se comprobó el inventario antes del fallback Git.

Se revisaron y sincronizaron cuatro capturas de Resultado en macOS (claro/oscuro, Chromium/WebKit). Mostraban un texto anterior a la palabra puntuables, ya presente en el commit de referencia 282f692; los valores siguen siendo 10/100, un acierto y nueve blancos. No cambia el ref de CI ni la tolerancia visual. Las ocho comprobaciones de pregunta/resultado aprobaron después. El conjunto integrado pasó arquitectura, lint, tipos, 1.004 pruebas con 29 omitidas, once pruebas editoriales y build 1.1.14.

### Activación editorial por contenido (68 registros)

La cuarentena se mantiene para las versiones antiguas del mismo ID, incluidas las cachés offline. El catálogo verifica **antes** de aplicar `np` el SHA-256 del registro completo contra `approved-question-hashes.ts` (13 publicadas: `reviewed-web.json`, `reviewed-T3.08.json`, `reviewed-T4.07.json`; 19 de `reviewed-19.json` y 36 de `reviewed-followup.json`). Ese módulo sólo contiene IDs y huellas: no incorpora preguntas ni respuestas al JavaScript público. El canon es JSON UTF-8 con claves ordenadas recursivamente, sin espacios; no debe confundirse con la huella de transporte del ledger, que conserva el orden de inserción. Las pruebas comparan los 68 `after` con los JSON locales y verifican ambos lados de cada propuesta.

Web Crypto se ejecuta en el adaptador; el dominio recibe un puerto SHA-256. Sólo una coincidencia exacta emite una marca Symbol privada ligada al canon íntegro, incluidos enunciado, opciones, clave, contexto, explicación, cita y `np`. Un spread idéntico la conserva; JSON/DTO/historia no la transportan y cualquier modificación la invalida. El motor vuelve a comprobarla al responder y cerrar; los entrenadores conservan el registro cargado para sus callbacks. El registro de IDs verificados sólo orienta selectores, nunca autoriza puntuación. `np:1` explícito no se elimina. Sin crypto, ante error o contenido distinto se mantiene la exclusión. La recuperación usa contenido recién cargado y la comparación de clave existente, sin reescribir resultados históricos.

Los avisos se calculan desde contenido comprobado; las dos figuras recuperadas AS09-P1-48/AS10B-P1-63 dejan de anunciar material ausente sólo con prueba válida. Los DTO de presentación reciben el aviso calculado, no una credencial. Las versiones antiguas siguen mostrando «Solo estudio». Para futuros lotes: añadir exclusivamente hashes del contenido aprobado, mantener la cuarentena del ID y ampliar las pruebas antes/después; no activar por versión de `meta` ni por un campo remoto `verified`.

Validación local: `tests/editorial-content-proof.test.js` cubre 68 antes/después, dos muestras, falsificación de metadatos, serialización, clones mutados, mutación durante digest, crypto ausente/error, avisos y callbacks de entrenadores. La integración del motor comprueba que una mutación posterior no escribe progreso ni entra en el denominador. Esta implementación no publica datos ni modifica reglas Firebase. Documentación API: [MDN SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest), consultada mediante Context7; se usa SHA-256/TextEncoder y conversión hexadecimal compatible, sin dependencia nueva.

El generador `node scripts/bank-editorial/generate-content-hashes.mjs` verifica los campos aprobados de los cinco manifiestos y toma el registro completo local; rechaza deriva y duplicados. Las pruebas reconstruyen los 13 `before` parciales borrando campos cuyo valor anterior era null, como replay. Así una caché v12 no puede reactivar la versión anterior de las 13 correcciones publicadas en v13. El publicador de 55 y las autorizaciones de datos permanecen intactos.

Comprobación de esta implementación: `npm run check` pasó 1.015 pruebas/29 omitidas (arquitectura, lint y tipos correctos), y `npm run build` pasó. Una comprobación posterior de 16 pruebas del motor añadió la aserción positiva de puntuación tras su recorrido real, además del rechazo de la clave mutada. Se conserva el aviso preexistente de jsdom `window.scrollTo` y la advertencia de tamaño de chunks; no se silencian. El primer arranque global falló en el beforeAll de design-flow y en dos contratos de fixture que se corrigieron; el archivo design-flow no se modificó y pasó tanto focalmente como en los globales siguientes. Evidencias locales: `work/content-proof/`.

Entrada fría en Falladas: sus candidatos se cargan antes de filtrar por prueba de contenido. Esto corrige el caso en que un ID revisado aún no se había inscrito al abrir directamente la ruta; los conteos conservan su contrato y la práctica vuelve a comprobar el contenido. La regresión reproduce el fallo anterior (loader recibía `[]`) y verifica las 13 versiones publicadas, sus predecesoras y metadatos falsificados. Tarjetas ya cargaba candidatos desde sus IDs guardados: no cambia esa selección. Su aviso ahora se proyecta desde el registro verificado, y `np:1` explícito mantiene prioridad sobre el aviso proyectado; comprobadas las 68 tarjetas y la vista con contenido antiguo/no puntuable. Focales: 29/29; lint, tipos y arquitectura correctos. El check/build conjunto final corresponde al worktree integrador.

CI109 detectó dos carreras test-only: el título Resultado precede al efecto que avanza el checkpoint, y recargar inmediatamente tras Pausar abortaba la nueva carga de `cards/index.json`. Las pruebas esperan el mismo checkpoint completo y la pausa ya pintada antes de recargar; mantienen todas las aserciones y el guard de errores. Repeticiones locales: ocho casos correctos (dos recorridos, dos motores, dos repeticiones). Con 800ms de latencia HTTP local real se registró una cancelación junto al pagehide antes del ajuste y ninguna después; no hubo `window.error`, rechazo no capturado ni pageerror. El texto de consola access-control observado en Linux no se reprodujo en macOS y no se ha silenciado. Evidencia local: `work/ci109/`.

# TAI · Preparación de oposiciones

TAI es una aplicación web progresiva (PWA) para preparar las oposiciones del cuerpo de Técnicos Auxiliares de Informática (TAI). Sirve para practicar preguntas y supuestos, preparar simulacros, repasar fallos con repetición espaciada y seguir el progreso por temas. Se puede instalar en móviles y tabletas y está diseñada para conservar el estudio sin conexión.

La aplicación combina un banco de preguntas de distintos orígenes —oficial, academia y generado— con tarjetas de repaso y herramientas para organizar el estudio. El origen del contenido se muestra para que se pueda valorar junto con cada respuesta.

> **Estado del proyecto:** `package.json` declara la versión 1.1.12. Las cifras del banco pueden cambiar al publicar contenido; consulta los índices de `public/data/` y `public/cards/` para conocer los datos incluidos en este checkout. El código y los datos locales no acreditan por sí solos el estado del despliegue ni el funcionamiento de una cuenta Firebase concreta.

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
- **Importar y exportar:** crear una copia de progreso, recuperar una copia anterior, gestionar el historial detallado y exportar tarjetas a Anki en texto tabulado. También hay una exportación de manifiesto, sesiones e informe para análisis asistido; se descarga bajo petición y no envía datos automáticamente.
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

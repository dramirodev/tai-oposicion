# E2E autenticado con Firebase Emulator

El registro canónico de hallazgos UX/ATE con estados, evidencia y pruebas está en [audit-findings.md](audit-findings.md); el contexto UX está en [journey-audit-report.md](journey-audit-report.md) y la auditoría de requisitos de la plataforma, en [extreme-platform-status.md](extreme-platform-status.md). No leer `.env`, no invocar el modelo para repetir journeys y no iniciar pruebas de escritura sin el preflight Emulator y guard de red.

## Usuarios ficticios y aislamiento

La prueba `auth-emulator.spec.ts` inicia sesión mediante la pantalla simulada de Google del Auth Emulator. Al elegir **Add new account** e introducir un correo, el emulador crea un usuario local; no se crea una cuenta de Google ni se contacta con Firebase de producción. La prueba usa una cuenta para estudiar y otra (`student@example.test`) para comprobar que el progreso no cruza cuentas.

El comando `npm run test:e2e:firebase-auth` arranca únicamente Auth y Firestore con el proyecto `demo-tai-auth`. Firebase CLI trata los proyectos `demo-*` como proyectos de demostración: las llamadas a servicios no emulados fallan. La prueba bloquea cualquier solicitud del navegador que no vaya a loopback en los puertos `4187` (app), `9099` (Auth) o `8080` (Firestore), salvo peticiones GET a recursos estáticos `https://apis.google.com/js/api.js` y `https://apis.google.com/_/scs/**` requeridos por el popup OAuth simulado. No se permite tráfico a endpoints reales de identidad/Firebase; al final se exige haber usado ambos emuladores.

Para extender el escenario, añade otro correo ficticio terminado en `.test` al flujo de UI y comprueba explícitamente sus datos antes y después de cambiar de cuenta. No pongas credenciales reales ni datos exportados de producción en una misión, un archivo de autenticación o una captura.

## Agentic Test Explorer

[Agentic Test Explorer](https://github.com/srbarrios/agentic-test-explorer) es un PoC de exploración web con misiones YAML, Playwright y generación de reproducciones. Se ha añadido un adaptador específico para el popup OAuth del Auth Emulator, que guarda `auth.json` incluyendo [IndexedDB](https://playwright.dev/python/docs/api/class-browsercontext#browser-context-storage-state), y un guard de red que bloquea todos los destinos del navegador salvo TAI/emuladores de loopback y los recursos GET estáticos requeridos por el popup simulado. El explorador no es una dependencia de producción de TAI.

### Preparar el entorno aislado (una vez)

Clona el explorador fuera de este repositorio y crea un entorno Python 3.11+ separado. Sigue el [README oficial](https://github.com/srbarrios/agentic-test-explorer#setup) para instalar sus dependencias y Chromium de Playwright. Define `AGENT_EXPLORER_DIR` apuntando a ese clon, que debe contener `.venv/bin/agent-explorer`. Configura un proveedor/modelo LLM compatible siguiendo el proyecto; las capturas y el contexto de la aplicación se envían a ese proveedor y pueden generar costes.

### Ejecutar una misión

Desde la raíz de TAI:

```bash
AGENT_EXPLORER_DIR=/ruta/al/agentic-test-explorer bash scripts/e2e/run-agentic-explorer.sh
```

El lanzador construye TAI, sustituye temporalmente `dist/firebase-config.json` por una configuración sintética `demo-tai-auth`, arranca exclusivamente Auth y Firestore Emulator, y restaura/elimina esa configuración al salir. Inicia el servidor de TAI en `127.0.0.1:4187`, crea un usuario ficticio `explorer@example.test` con el popup **Add new account**, y guarda el estado en `auth.json` dentro del clon aislado. La sesión incluye IndexedDB para que Firebase Auth pueda restaurarla. Luego aplica el guard de red a `src/agentic_explorer/main.py` del clon y ejecuta la misión [`tai_auth_chaos.yaml`](missions/tai_auth_chaos.yaml), con un máximo de 60 pasos y navegador visible.

El guard local corta solicitudes de navegador fuera de `127.0.0.1`/`localhost` en puertos `4187`, `9099` y `8080`, con la única excepción de GET a `https://apis.google.com/js/api.js` y `https://apis.google.com/_/scs/**`. También deshabilita service workers en los contextos Playwright. Firebase CLI usa el proyecto de demostración `demo-tai-auth`; según la [documentación oficial de Firebase](https://firebase.google.com/docs/emulator-suite/connect_rtdb#choose_a_firebase_project), los servicios no emulados de un proyecto demo no tienen recursos reales asociados y fallan en lugar de acceder a producción. El test de red ya existente es otra barrera independiente para el flujo determinista.

El patch de guard es local al clon del explorador y el instalador verifica su ancla antes de editar; una versión no reconocida falla cerrada sin escribir. Si se ejecuta más de una vez, detecta el guard instalado. Los artefactos e historial SQLite del explorador quedan en su clon, no en TAI. Revisa `action_tape.jsonl`, informes y capturas antes de convertir un hallazgo en un test determinista; una reproducción sugerida por el agente es una hipótesis, no prueba automática de un bug.

La misión usa un único usuario sintético y solicita caos de sesión/navegación. Para probar aislamiento entre cuentas, incorpora una segunda cuenta `.test` al flujo de misión sólo cuando la interacción y las reglas de datos estén descritas con pasos verificables. Nunca uses cuentas, credenciales ni datos de producción.

Estado del primer corte (histórico, sustituido por la revalidación más reciente al final de este documento): el adaptador estaba implementado, pero el runtime de Python y la cuenta de modelo todavía no estaban preparados.

## Diagnóstico del fallo de planificación (2026-11-04)

El fallo reproducido no estaba en la selección del plan: la actividad **Preguntas del tema prioritario** aparecía en la sesión activa, pero la aserción buscaba la posición fija `nth(1)`, que corresponde al test variado añadido al plan actual. La prueba ahora localiza la actividad por su título y verifica que contiene el tema evaluado. Así mantiene la expectativa funcional y deja de depender del orden/índice de otras actividades.

Verificación: `npm run test:e2e:firebase-auth` pasó en Chromium (1 passed, 1 WebKit skipped). La configuración `demo-tai-auth`, el bloqueo de destinos externos y la observación de conexiones locales a `:9099` y `:8080` confirman que el recorrido utilizó Auth y Firestore Emulator.

## Propietario sintético y matriz de autorización (2026-11-04)

Ejecuta `npm run test:e2e:supertest`. El lanzador usa únicamente `demo-tai-auth`, Auth `127.0.0.1:9099`, Firestore `127.0.0.1:8080` y app `127.0.0.1:4191` (Explorer utiliza `4187`). Necesita Java, Chromium de Playwright y los puertos libres. No requiere credenciales Firebase. Rechaza credenciales de servicio y proyectos/hosts diferentes antes de cargar Admin SDK.

`prepareSyntheticUsers()` en `scripts/e2e/synthetic-users.mjs` restablece cuatro UID reservados y sus documentos anidados antes de cada caso y misión. Se crean `tai-supertest@example.test` (propietario verificado), `tai-normal@example.test` (aprobado), `tai-restricted@example.test` (sin aprobación) y `tai-pending@example.test` (solicitud pendiente). El escenario anónimo usa un contexto de navegador limpio sin login. Cada prueba usa almacenamiento nuevo y los emuladores se apagan al terminar. No se exportan usuarios ni datos entre ejecuciones.

La autorización real no reconoce custom claims. El propietario depende de correo verificado; los usuarios normales dependen de `access/{uid}.ok`. Por eso no inventamos claims `admin`/`superadmin`. El lanzador genera en un directorio temporal una copia de **todas** las reglas actuales con una única sustitución: el correo del propietario por el sintético. Comprueba que el ancla sea única. Nunca modifica `firestore.rules` ni publica reglas. Es una parametrización de identidad de prueba; conserva validación, aislamiento y prohibiciones. Admin SDK solo prepara/restablece identidades y permisos. Las operaciones verificadas se realizan mediante UI y SDK cliente sujeto a reglas.

La aplicación reconoce el propietario sintético solamente si la configuración solicita emuladores de loopback y proyecto exacto `demo-tai-auth`. Una configuración inválida de emuladores aborta antes de inicializar Firebase. La interfaz en emuladores omite la excepción de desarrollo local para que las pruebas negativas comprueben permisos reales. En producción la identidad y autorización existentes no cambian.

Auditoría del código (`access-control.ts`, `access-policy.ts`, `access-composition.ts`, `route-runtime.tsx`, `firestore.rules`):

| Nivel | Módulos completos | Gestionar accesos | Datos remotos |
| --- | --- | --- | --- |
| Anónimo / invitado | Sesión rápida, Inicio, Ayuda, Ajustes públicos | No | No |
| Autenticado sin aprobar | Igual; puede solicitar acceso | No | Su solicitud y lectura de su aprobación |
| Pendiente | Igual; solicitud visible | No | Igual |
| Aprobado verificado | Planificación, Temario/materiales, test, simulacros, progreso, entrenadores, falladas, errores, curación | No | Banco en lectura y datos propios validados |
| Propietario verificado | Todos los módulos habilitados | Aprobar, rechazar, revocar | Datos propios; no historial de otros ni escritura del banco |

Las rutas restringidas son `/temario`, `/planificacion`, `/errores`, `/falladas`, `/relampago`, `/trampas`, `/lectura`, `/curar-contenido`, `/test`, `/sim`, `/sim2`, `/stats`. `/acceso` tiene guard adicional de propietario. `/cards` redirige a Inicio porque está oculto, también al propietario. `/quiz` y `/result` son rutas de ejecución/resultados públicas para la sesión rápida; no conceden permisos remotos. `/examenes` redirige al flujo de simulacros. El modo local ordinario conserva su excepción de desarrollo; no es evidencia de permisos Firebase.

Las reglas cubren banco, aprobaciones, solicitudes, estadísticas, sesiones, intentos/eventos, checkpoints y configuración de estudio, evaluaciones en papel, calendario, agenda semanal, materiales/eventos curriculares, tarjetas e informes. Incluso el propietario solo opera sobre su UID; no tiene permiso cliente de publicar el banco ni de saltarse esquemas o inmutabilidad. Denegación por defecto para documentos no reconocidos.

Explorer: `AGENT_EXPLORER_DIR=/ruta/al/explorer bash scripts/e2e/run-agentic-explorer.sh`. Utiliza la misma preparación/reglas y login Google simulado, verifica la pantalla Accesos antes de guardar `auth.json` con IndexedDB y entrega la misión ampliada a todos los módulos reales. Para cambiar el perfil usa `TAI_EXPLORER_EMAIL=tai-normal@example.test` (o restricted/pending); el propietario es el predeterminado. El proveedor LLM y Python compatible siguen siendo requisitos del clon externo. El guard bloquea tráfico externo del navegador salvo los recursos estáticos GET de Google necesarios para el popup. La ejecución determinista Playwright no usa un LLM.

### Verificación y continuidad de esta fase

El recorrido del propietario usa una fecha de estudio fija y crea sus datos desde la interfaz: tema semanal, sesión de planificación, material estudiado, autoevaluación en papel, hito de tres preguntas, respuestas y resultado. Comprueba después el documento de autoevaluación y la sesión de intentos remotos usando **el token de la cuenta del navegador**, sujeto a las reglas. Abre los módulos restringidos, Inicio, Ayuda, Ajustes y Accesos; aprueba y revoca una solicitud desde la UI. Es cobertura de entrada para todos los módulos y cobertura funcional del recorrido descrito, no una certificación exhaustiva de cada operación o estado interno de todos los módulos.

La matriz del SDK cliente verifica lecturas propias y aislamiento en 16 familias de documentos, lectura del banco, validación de escritura, denegación de escritura del banco incluso al propietario y denegación de autoaprobación/listado de accesos a otros perfiles. Se verificó en Chromium; no se certifican WebKit ni dispositivos físicos en esta fase.

La preparación de Explorer se comprobó por separado sin invocar ningún proveedor:

```bash
AGENT_EXPLORER_DIR=/ruta/al/explorer TAI_EXPLORER_PREPARE_ONLY=1 bash scripts/e2e/run-agentic-explorer.sh
```

Este modo prepara/restablece usuarios, aplica las reglas con identidad sintética, reutiliza `synthetic-auth.ts` mediante `prepare-explorer-session.mjs`, verifica Accesos y guarda `auth.json` con IndexedDB. Sale antes de `agent-explorer`. Se verificó con Node 24.22.1 y el clon disponible con Python 3.14.6, superando las limitaciones del entorno histórico descritas arriba. No necesita una clave LLM para esta comprobación local.

La misión de descubrimiento con Gemini se autorizó y se lanzó en tres pasadas; la última quedó parcial después de tres respuestas 429 por cuota. El informe [`explorer-mission-2026-11-04.md`](explorer-mission-2026-11-04.md) conserva los resultados, candidatos revisados y límites. No volver a invocar el proveedor mientras la cuota siga agotada. La misión determinista de rutas descrita al final no envía capturas ni estado a un modelo.

Se corrigieron además dos fixtures de `tests/planning-page.test.js` que dependían del día real: ambos escenarios declaran ahora explícitamente enfoque de contenido nuevo. Las 23 pruebas de ese archivo pasan. Los cambios previos en README, `auth-emulator.spec.ts`, scripts/misiones y el informe local de planificación se conservaron.

Resultados finales: `npm run test:e2e:supertest` **6/6** (49,4 s); preparación de Explorer sin proveedor **correcta**; `npx vitest run --maxWorkers=2` **952 aprobadas / 27 omitidas**; arquitectura, lint, tipos y build correctos. El comando `npm run check` con paralelismo predeterminado registró una intermitencia en `design-flow.test.js`; el recorrido completo de Vitest con dos procesos pasó. Se mantienen avisos conocidos de Rollup/Zod y chunks grandes. No se modificaron ni desplegaron reglas productivas.

## Explorer autorizado y hallazgos revisados (2026-11-04)

El envío a Gemini está autorizado y se ejecutó. Estado vigente y evidencia: [informe de misión](explorer-mission-2026-11-04.md). Cada lanzamiento crea `test-results-explorer/run-XXXXXX/` con `auth.json`, SQLite, YAML e informes independientes; ya no reutiliza la memoria ni sobrescribe informes del clon. `launch-isolated-explorer.py` fuerza Gemini y desactiva MCP/habilidades externos. El guard también adapta los resultados de los agentes a mensajes nuevos cuando `TAI_AGENT_EMULATOR_ONLY=1`.

La regresión offline del adaptador se ejecuta con `AGENT_EXPLORER_DIR/.venv/bin/python scripts/e2e/test-explorer-deltas.py` (sustituir la ruta del clon). No llama al proveedor. La preparación sin proveedor continúa disponible mediante `TAI_EXPLORER_PREPARE_ONLY=1`; sus artefactos ahora quedan en el directorio de la pasada.

El parámetro `--max-steps 60` pertenece al ciclo del supervisor de este PoC; no debe interpretarse como garantía de un presupuesto global de llamadas LLM. En esta ejecución se detuvo la pasada tras tres rechazos de cuota. La autorización persiste para reintentar cuando haya capacidad. La cobertura de un informe del modelo debe cotejarse con `action_tape.jsonl` y reproducciones independientes.

La revisión corrigió bloqueo de arranque de rutas protegidas y carrera del logout. El estado final pasa **957 tests**, **7 E2E supertest** y el **journey Auth de dos cuentas** en Chromium. Los candidatos sobre Planificación y Accesos fueron falsos positivos; la nueva regresión navega por sus enlaces reales, usa atrás/adelante y recarga. No se certifica cobertura LLM completa ni WebKit con estos resultados.

## Auditoría de UX e IA — verificación posterior (2026-11-04)

Actualización de auditoría continua (4/11/2026): `npm run check` pasa con **958 aprobadas/27 omitidas**. La pasada completa `npm run test:e2e:ci` verificó baseline **70/70** y candidata **188 aprobadas/66 fallidas/16 omitidas**; reconciliación de 66 IDs/contextos: 64 capturas contra la referencia histórica y los 2 timeouts WebKit de UX-007. Las capturas candidatas se compararon en `routes.spec.ts`: **86/86** aprobadas entre Chromium/WebKit, claro/oscuro y rutas adicionales. Los 64 deltas son diferencias frente a `baseline-ref.txt` anterior; se inspeccionaron los 16 estados, y 20 referencias candidatas (cinco rutas) se actualizaron selectivamente tras confirmar las causas UX-004/UX-010 y contenido vigente. El runner histórico seguirá mostrando ese drift hasta avanzar su referencia en un commit revisado. No se declara cerrado el resto de la auditoría: journeys autenticados extensos, WCAG manual y causalidad WebKit siguen pendientes.

El detalle consolidado de inventario, mapas actual/propuesto, recorridos, heurísticas, límites WCAG y resultados visuales está en [journey-audit-report.md](journey-audit-report.md). Última ejecución `npm run test:e2e:ci` (4/11/2026): baseline **70/70**; la candidata produjo **186 aprobadas, 66 fallidas y 16 omitidas** (268 tests). Las expectativas de `cards` ya reflejan su redirect a Inicio y pasan en ambos motores/temas; no son fallos actuales. Se clasificaron **64 discrepancias visuales** contra el baseline histórico y **2 timeouts WebKit** del repaso. Los 66 `error-context.md` y la lista `failedTests` de `.last-run.json` coinciden. No se aceptaron snapshots en masa. Programar, confirmar, recargar, reprogramar y abrir el repaso pasa en Chromium claro y oscuro. En WebKit, `selectOption` falla con `visibility:hidden` en `main.planning-page`; aún no se localiza el origen. Los casos Emulator se omiten en la suite general y se ejecutan por separado.

La navegación se reorganizó localmente en ambos modos: Planificación y Temas estudiados bajo “Planificar”; Preguntas falladas y Progreso bajo “Seguimiento”. Tras el cambio, `npm run check` pasó arquitectura, ESLint, TypeScript y **957 pruebas aprobadas / 27 omitidas**; E2E focal de menú/foco/teclado **4/4 Chromium/WebKit**; `npm run build` completó. Permanecen las advertencias conocidas de Zod/Rollup y chunks grandes. Mantener Firebase de producción intacta. La exploración Gemini sigue parcial por cuota 429; no declarar auditoría integral cerrada hasta resolver los pendientes del informe.

Hallazgo posterior de navegación móvil: `/#/falladas` resaltaba Inicio porque el mapeo heredado `falladas → home` no seguía la agrupación Seguimiento. Se corrigió a `falladas → stats`; la prueba unitaria de `useActiveSection` y el E2E “Preguntas falladas mantiene activo Seguimiento” pasan en Chromium y WebKit (**2/2**). Esto verifica la señal accesible `aria-current` y el estilo de pestaña activa.

Revalidación de seguimiento (4/11/2026): se eliminó el selector de actividad sin alternativas en “Programar un repaso”; la acción sigue creando `topicTest`, y duración/fecha/tema, confirmación y persistencia conservan el comportamiento. El journey focal pasó **2/2 en Chromium** (tema claro y oscuro). En WebKit, `selectOption` sigue bloqueado por `visibility:hidden` en `main.planning-page`; no se aumentó el timeout. Tras corregir la expectativa de `cards`, la suite integral reportó **186/66/16**; siguen las discrepancias visuales y los dos timeouts. El rerun focal anterior de `routes.spec.ts` dio **35/43**; sus diferencias iniciales de Inicio/Ajustes/Falladas y las capturas WebKit seleccionadas siguen preservadas en `evidence/ux-audit-2026-11-04/`.

Hallazgo visual `UX-010`: en WebKit móvil el icono de “Pregunta relámpago” ocupaba una línea propia por el reset global de SVG (`display:block`), desplazando contenido de respuesta. La utilidad compartida ahora declara `display:inline-block`. Regresión focal en Chromium y WebKit (**1/1 por motor**) comprueba visibilidad y línea compartida también en Detective de trampas; `npm run check` pasa (**958 aprobadas/27 omitidas**). `UX-007` continúa abierto: el control de duración del repaso sigue bloqueado en WebKit y el origen de `visibility:hidden` no está aislado.

## Agentic Test Explorer: lotes deterministas y cuota de Gemini

El modo de exploración adaptativa mantiene a Gemini para descubrir escenarios nuevos. El clon disponible expone el ejecutor por módulo (puede no tener instalado el binario `agent-explorer-batch`). Para escenarios ya definidos, el wrapper de TAI lanza el módulo Python sin modelo y conserva los artefactos por ejecución:

```bash
AGENT_EXPLORER_DIR=/ruta/al/agentic-test-explorer \
TAI_EXPLORER_SCENARIOS=tests/e2e/missions/tai-owner-route-smoke.yaml \
TAI_EXPLORER_PROFILE=extreme \
TAI_EXPLORER_SEED=20261104 \
bash scripts/e2e/run-agentic-explorer.sh
```

El runner comprueba el clon y Python, compila TAI y arranca solo Auth/Firestore Emulator. El batch usa `python -m agentic_explorer.scenario_batch`; no genera escenarios ni llama a Gemini. Perfiles `fast`, `intensive` y `extreme` filtran por `min_profile`; no alteran las aserciones ni eliminan pasos de los escenarios que ejecutan. La generación adaptativa mediante solicitud de modelo es independiente y está sujeta a cuota.

Para Firebase fija `TAI_AGENT_EMULATOR_ONLY=1`; el adaptador exige `GCLOUD_PROJECT=demo-tai-auth`, Auth `127.0.0.1:9099`, Firestore `127.0.0.1:8080`, app local `127.0.0.1:4187` y estado por ejecución en `test-results-explorer/run-*/auth.json` asociado a `@example.test`. La comprobación bloquea cualquier proyecto/configuración de producción y destinos de red externos a la lista local permitida.

La evidencia queda en el directorio de salida de cada ejecución: escenario y semilla, Action Tape por paso, snapshots DOM, capturas, resultado y resumen de uso de modelo. La solicitud amplia está en `tests/e2e/missions/tai-full-journeys-request.md`. Antes de convertir recorridos propuestos en un YAML ejecutable, contrasta rutas y selectores con la app y los tests existentes; no trates una simple visita a una página como journey completo.

## Perfiles deterministas de Agentic Test Explorer

Con Agentic Test Explorer instalado en `AGENT_EXPLORER_DIR`, los comandos siguientes usan el wrapper TAI, preparan un usuario owner sintético y ejecutan Auth/Firestore Emulator (`demo-tai-auth`). No invocan Gemini. Los tres comandos consumen la misión `missions/tai-profile-stress.yaml`; cada perfil agrega escenarios, no debilita aserciones:

```bash
AGENT_EXPLORER_DIR=/ruta/al/agentic-test-explorer npm run test:explorer:quick
AGENT_EXPLORER_DIR=/ruta/al/agentic-test-explorer npm run test:explorer:intensive
AGENT_EXPLORER_DIR=/ruta/al/agentic-test-explorer npm run test:explorer:extreme
```

La misión navega repetidamente a Planificación en los límites de 10, 50, 100, 500 y 997 clics; cada escenario añade navegación y aserciones y EXTREME queda acotado a 1.000 acciones por escenario. Comprobación más reciente: QUICK 2/2, INTENSIVE 4/4 y EXTREME 6/6; incluye recuperación atrás/adelante/recarga y cubre 10/50/100/500/997 clics y hasta 1.000 pasos de escenario; 0 llamadas LLM. Esto valida repetición de navegación y salud de página autenticada, no reemplaza journeys de escritura/persistencia ni certifica todos los controles de TAI. Los artefactos con `run.json`, `scenario.yaml` y `action_tape.jsonl` se conservan por ejecución en `test-results-explorer/run-*` (directorio ignorado por Git).

## Revalidación de acceso completo y UX (4 de noviembre de 2026, último corte)

- La preparación del Auth Emulator consultó `tai-supertest@example.test`: **no existía** en el primer arranque aislado `demo-tai-auth`; el fixture reservado se creó y después se autenticó con éxito. En cada caso siguiente se detectó su UID esperado y se restableció solo esa identidad de Emulator.
- `npm run test:e2e:supertest`: **7/7 Chromium** con Auth/Firestore Emulator. El propietario comprobó Planificación → Temario → autoevaluación → test/hito → Resultado → Progreso; rutas de módulos y Accesos; atrás/adelante/recarga; aprobar y revocar; permisos, aislamiento y escrituras no permitidas por Firestore. Los cinco perfiles cubiertos fueron propietario, usuario aprobado, restringido, pendiente y anónimo/invitado. Ningún servicio productivo se usó.
- `tai-owner-route-smoke.yaml`: **1 escenario / 48 pasos / 16 módulos**, determinista, propietario sintético, 0 llamadas LLM. Las acciones combinan visita de ruta, encabezado y salud de página. El resultado completo vive bajo `test-results-explorer/run-*/scenario-results/` y es local/ignorado. Las capturas persistentes de Planificación, Tema, Resultado, Progreso, Curación y Accesos están en [`evidence/ux-audit-2026-11-04/`](evidence/ux-audit-2026-11-04/).
- `npm run check`: **958 pruebas aprobadas / 27 omitidas**; arquitectura, ESLint y TypeScript pasan. Suite E2E anterior a la corrección de `cards`: baseline **70/70**, candidata **182 aprobadas / 70 fallidas / 16 omitidas**; cuatro expectativas de `cards` ya corregidas. La reejecución posterior pasa **186/66/16**: quedan 64 discrepancias de captura y 2 timeouts WebKit. No se actualizaron snapshots automáticamente; `tests/e2e-baseline.test.js` verifica que el runner restaure snapshots aunque falle la comparación.
- WebKit reproduce `element is not visible` en `selectOption` al configurar el repaso. Durante la acción, `main.planning-page` y su contenido computan `visibility:hidden`; no aparecen clase `invisible`, estilo inline ni subárbol `inert`; `body`, `#app` y `route-transition` computan `visible`. El origen de cascada/transición queda sin aislar; no se subió el timeout ni se debilitó el journey.
- La revisión de screenshots WebKit incluye muestras actuales y diferencias de Inicio, Ajustes, Relámpago y Parte 2; los demás diffs cubren Quiz/Resultado, Test, Simulacros, Temario, Seguimiento, Entrenamientos y Accesos en ambos temas. Las diferencias contra la referencia de interfaz anterior no se aceptan como regresiones automáticamente. El estado activo corregido de Falladas es intencional y las capturas anteriores ya están preservadas.
- Pendiente: repetir la suite E2E completa después del cambio de expectativa de `cards`, aislar y corregir/ratificar el timeout WebKit, revisar manualmente los criterios restantes WCAG 2.2 AA y completar casos de concurrencia, offline autenticado y token expirado. La cobertura Gemini queda parcial por cuota 429. La auditoría global sigue abierta.

## Perfiles CI y verificación adicional (5 de noviembre de 2026)

- **QUICK en PR:** `.github/workflows/ci.yml` ejecuta `npm run test:e2e:supertest` dentro de Auth/Firestore Emulator con `demo-tai-auth`, además de las comprobaciones existentes. Trazas, resultados y capturas se publican como artefacto de 14 días.
- **INTENSIVE:** `.github/workflows/e2e-profiles.yml` ejecuta semanalmente (lunes 06:00 UTC) o bajo demanda el supertest autenticado y la suite determinista Chromium/WebKit. No usa Gemini.
- **EXTREME bajo demanda:** el workflow añade `npm run test:e2e:extreme`: escenario Playwright determinista de 1.000 acciones alternadas en el menú móvil, en Chromium y WebKit, con aserciones de visibilidad y retorno de foco. La prueba se omite en QUICK/INTENSIVE para mantener el estrés fuera de PR y agendas. No realiza escrituras Firebase ni llamadas a modelo. La misión EXTREME integrada con ATE permanece disponible localmente mediante `npm run test:explorer:extreme` y requiere el checkout del framework.
- **Verificación local de este corte:** `npm run test:e2e:supertest` **11/11** Chromium Emulator; rutas sintéticas **16 escritorio + 2 móviles**, con **312 controles accesibles** encontrados y cero nombres vacíos; se suman recorridos de tres pasos de Lectura atenta y validación/filtro/guardado local de Curación. `mobile-layout`, `react-pages` y `stats-charts` **30/30** Chromium/WebKit; menú EXTREME **1.000 acciones** superó Chromium y WebKit. El recorrido diario y EXTREME focal pasaron **4/4**. Capturas e inventario: [`evidence/accessibility-2026-11-05/`](evidence/accessibility-2026-11-05/), [`evidence/extreme-2026-11-05/`](evidence/extreme-2026-11-05/) y regresión WebKit en [`evidence/ux-audit-2026-11-04/`](evidence/ux-audit-2026-11-04/). Checklist y límites de la revisión manual: [`accessibility-manual-review.md`](accessibility-manual-review.md).
- La rama de auditoría está publicada; GitHub Actions aún no tiene ejecución remota verificable porque `e2e-profiles.yml` no está en la rama por defecto para su dispatch. La prueba con lector de pantalla, zoom de navegador a 200%/400%, contraste integral y cobertura de cada control/estado dinámico continúan pendientes; no se declara conformidad WCAG completa ni cierre global de ATE-005/ATE-006.

### Reanudación autenticada tras una interrupción — 5 de noviembre de 2026

`npm run test:e2e:supertest` pasó **12/12**. El nuevo caso sintético prepara T1.02 desde la interfaz, crea un hito, guarda respuesta y avance, recarga como `tai-supertest@example.test`, reanuda en pregunta 2 de 3, verifica los datos del checkpoint del UID y abandona como sesión interrumpida. Confirma que se limpia el checkpoint al finalizar. Capturas: `evidence/accessibility-2026-11-05/authenticated-run-before-reload.png`, `authenticated-run-resume-prompt.png`, `authenticated-run-resumed.png`.

El almacenamiento de ejecución es local; este escenario no afirma recuperación entre dispositivos. La cuenta, reglas y lecturas/escrituras Firebase permanecieron en Emulator. ATE-005 sigue abierto para concurrencia, cambio/expiración de cuenta, offline, estados dinámicos restantes y cobertura exhaustiva. UX-009 y CI remota ATE-006 siguen pendientes.

### Comparación funcional en Estadísticas — 5 de noviembre de 2026

`npm run test:e2e -- tests/e2e/stats-charts.spec.ts` pasó **8/8** en Chromium y WebKit. Con dos simulacros sintéticos (70 y 80), se seleccionan Intento A/B y se verifica que invertir el orden invierte el resultado (**+10 / −10**). Se repite en temas claro/oscuro y viewports de 320 y 1440 px; se conserva [`stats-comparison-reversed.png`](evidence/accessibility-2026-11-05/stats-comparison-reversed.png). Usa progreso local de prueba; no se conecta a Firebase. No cubre todos los filtros ni sustituye la validación de estadísticas sincronizadas.

El mismo caso verifica que la evolución conserva tras recarga «Tiempo por pregunta», el periodo de ocho semanas y la tabla activada. La semilla de `tai.v1:guest` se aplica solo si no existe snapshot, de forma que el código de preparación no sobrescribe las preferencias guardadas por la aplicación durante `page.reload()`. Evidencia: [`stats-evolution-preferences-restored.png`](evidence/accessibility-2026-11-05/stats-evolution-preferences-restored.png). La primera ejecución reveló este defecto del fixture (no del producto); la repetición pasó 8/8.

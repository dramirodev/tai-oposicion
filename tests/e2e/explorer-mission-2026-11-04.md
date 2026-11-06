# Misión adversarial con Gemini — 4 de noviembre de 2026

La exploración se ejecutó con autorización explícita del usuario y exclusivamente contra `demo-tai-auth`. Se revisaron sus candidatos y se corrigieron **dos defectos funcionales de TAI y uno del adaptador de Explorer**. La exploración autónoma quedó parcial tras tres rechazos 429 por cuota de Gemini; no se presenta como una misión exhaustiva completada ni como un informe final generado por Gemini.

## Entorno y aislamiento

Auth Emulator `127.0.0.1:9099`, Firestore Emulator `127.0.0.1:8080`, app local `127.0.0.1:4187` y propietario `tai-supertest@example.test`. No se prepararon cuentas personales ni se accedió a Firebase de producción. La copia temporal de las reglas conserva sus validaciones y sustituye únicamente la identidad del propietario; `firestore.rules` permanece intacto.

Cada pasada usa un directorio nuevo bajo `test-results-explorer/`, con sesión, SQLite, misión e informes propios. Se conservan los históricos del clon de Explorer. El lanzador fuerza Gemini, omite MCP externos, utiliza una carpeta vacía de habilidades y solo carga las variables necesarias del proveedor. Los guards del navegador limitan su tráfico a app/emuladores y recursos estáticos del popup simulado. No se incluyen claves del proveedor ni `auth.json` en este informe.

## Ejecución observada

| Pasada | Acciones registradas / correctas | Evidencia y cierre |
| --- | --- | --- |
| `run-hh4Aps` | 13 / 2 | Inicio y Planificación. Se detuvo al repetir selectores inexistentes y propagar un candidato falso. |
| `run-HgR64V` | 14 / 13 | Inicio, Planificación y Accesos. El propietario revocó al usuario normal y aprobó al pendiente desde la UI. Se conservó la pasada al reproducir la duplicación del historial entre agentes. |
| `run-QAQIs1` | 31 / 21 | Inicio, Planificación, Accesos, Temario, Simulacros, cuestionario y Progreso. Abrió/reanudó un simulacro; no consta un resultado completo. Se cerró después de tres rechazos 429 y esperas de reintento de 35, 52 y 67 segundos. |

Modelo registrado: `gemini-3.1-flash-lite`. Las cuentas alternativas y todos los módulos no se recorrieron exhaustivamente por el LLM; esa cobertura no se infiere de sus resúmenes. La cinta de acciones es la referencia sobre lo que ocurrió.

Las cintas y trazas están dentro de cada `run-*/report_tai_auth_chaos_explorer_02_run-*/`. Los emuladores se apagaron y el estado sintético se restablece antes de cada nueva ejecución.

## Candidatos descartados

**«Planificación no abre»**: el agente utilizó `a[href='/planning']`, inexistente. El enlace real tiene `href="#/planificacion"`. Una reproducción independiente confirmó navegación, atrás, adelante y recarga. La propia cinta también registra una apertura correcta mediante un enlace observado.

**«Accesos no abre»**: utilizó `a[aria-label='Accesos']` y `a[href='/#/acceso']`; no corresponden al enlace real `href="#/acceso"`. Las cintas registran entrada correcta a Accesos, y la regresión final comprueba el enlace real y su recarga.

**Veredicto: dos falsos positivos de selección del agente, sin modificación de rutas ni permisos para acomodarlos.** Los fallos al esperar un `nav` oculto en escritorio o al interactuar con un diálogo tampoco se contabilizan por sí solos como errores de TAI.

Evidencia local: `run-hh4Aps/verified-planning-navigation.json` y `.png`; cintas originales; nueva prueba de navegación en `tests/e2e/supertest-emulator.spec.ts`.

## Defectos corregidos

### TAI: bloqueo de arranque al recargar una ruta protegida

La reproducción permanecía en «Cargando» incluso después de 15 segundos, sin errores de consola ni peticiones fallidas. El DOM interno mostraba «Cargando la pantalla…».

Causa: la ruta esperaba `accessResolved` para montar su contenido, mientras `bootAppServices` esperaba la señal de esa ruta para inicializar Firebase. Ninguno podía avanzar. `ReactScreen` ahora libera la señal de arranque mientras conserva la carga y oculta el contenido protegido hasta resolver los permisos. No se relaja la autorización.

Prueba: `tests/react-screen-bootstrap.test.js` falló antes del cambio por ausencia de la señal y pasa después. Las recargas de Planificación y Accesos y los rechazos de perfiles inferiores pasan en el emulador. Diagnóstico previo en `run-QAQIs1/navigation-replay-failure.json` y `.png`.

### TAI: cierre de sesión cancelado por una navegación antigua del shell

El journey de dos cuentas limpiaba la identidad y el progreso visible, pero permanecía en Ajustes. La instrumentación confirmó que el callback de cuenta sí ordenaba ir a Inicio; un efecto de `useLayoutAccess` volvía a navegar a la ruta anterior cuando cambiaba `full`, cancelando ese destino.

Se eliminó esa navegación redundante. El shell sigue actualizándose por sus suscripciones; los guardas y el arranque de cuenta conservan la responsabilidad de navegación. Se preservó la aserción original de retorno a Inicio y todo el recorrido de aislamiento.

Prueba: ambos casos de `tests/layout-access-navigation.test.js` fallaban antes y pasan después; el journey completo `auth-emulator.spec.ts` pasa. La instrumentación temporal se retiró.

### Explorer: historial y candidatos anteriores añadidos de nuevo como resultados

El adaptador devolvía toda la conversación del agente interno a un estado padre que ya la conservaba. Eso duplicaba contexto y podía reemitir candidatos antiguos. La regresión offline devolvía tres mensajes cuando debía producir únicamente una observación nueva.

El guard local corrige el resultado a mensajes nuevos bajo `TAI_AGENT_EMULATOR_ONLY=1`, añade una instrucción de nuevo turno y exige evidencia para distinguir errores del agente de defectos de la app. Las ejecuciones ordinarias del clon conservan su comportamiento. El instalador comprueba anclas reconocibles antes de modificarlo.

Prueba offline: `scripts/e2e/test-explorer-deltas.py` falla antes y pasa después; las nueve pruebas de contexto del clon también pasan. Las propuestas de Gemini continúan necesitando revisión y reproducción independiente.

## Verificación final

- `npm run check`: arquitectura, lint, tipos y **957 aprobadas / 27 omitidas**.
- `npm run test:e2e:supertest`: **7/7 Chromium**, incluyendo el recorrido de estudio completo, persistencia remota autenticada, enlaces reales/recarga y perfiles con menos permisos.
- `npm run test:e2e:firebase-auth`: **1 aprobada Chromium / 1 omitida WebKit**, incluidos cambio de día, recarga y aislamiento entre dos cuentas.
- Regresión offline de historial Explorer: **1/1**; contexto del clon: **9/9**.
- Build y comprobación de diferencias correctos; se conservan los avisos conocidos de Rollup/Zod y chunks grandes.

## Continuidad

La autorización para Gemini está concedida; no hay que solicitarla de nuevo. Falta repetir la exploración extensa cuando la cuota permita avanzar, revisar nuevos candidatos y convertir reproducciones válidas en regresiones. No se certifican todos los estados de todos los módulos, expiración real de tokens, concurrencia entre dispositivos, offline combinado, WebKit ni dispositivos físicos por esta ejecución.

El recorrido determinista sí completa planificación, estudio, autoevaluación, preguntas, resultado, persistencia y consulta de progreso/estadísticas. No se mezcla esa evidencia con la cobertura parcial del LLM.

No se hizo commit, push ni despliegue. Se preservaron los cambios concurrentes y el informe local de planificación sin versionar.

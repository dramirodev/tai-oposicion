# Instrucciones permanentes para agentes de desarrollo

## Alcance y principio rector

Estas reglas se aplican a todo el repositorio y a cualquier tarea ejecutada por agentes de IA. Este es un proyecto existente: evoluciona, no reconstruyas. Las instrucciones específicas de cada tarea complementan estas reglas, pero no autorizan acciones destructivas implícitas.

## Antes de cambiar código

1. Lee este archivo, el README, la documentación arquitectónica y el handoff existente. Localiza su ruta real; no inventes otra.
2. Inspecciona el árbol del proyecto, scripts, dependencias, modelos, rutas, estado, servicios, persistencia, componentes, estilos y tests relacionados.
3. Ejecuta `git status` y preserva todos los cambios preexistentes, especialmente los no confirmados.
4. Busca implementaciones equivalentes o parciales. Contrasta el handoff con el código: el código es la referencia sobre qué está implementado.
5. Establece una línea base de lint, typecheck, tests y build cuando existan, y documenta los fallos previos.

## Arquitectura y convenciones

- Respeta la arquitectura real del repositorio: estructura de carpetas, convenciones de nombres, contratos, modelos, responsabilidades, hooks, componentes, stores, servicios, rutas, persistencia, sistema de diseño y estrategia de pruebas.
- No impongas arquitecturas nuevas ni reorganices carpetas por preferencia personal.
- Reutiliza y amplía módulos existentes antes de crear otros. Evita duplicar lógica o reconstruir funcionalidades ya desarrolladas.
- Mantén tipado estricto y las convenciones TypeScript actuales; evita `any` innecesario. Separa lógica de dominio, presentación y persistencia siguiendo los patrones ya establecidos.
- No presupongas tecnologías: comprueba si se usan React Router, Zustand, Recharts, Firebase u otras antes de decidir.
- Respeta accesibilidad, diseño responsive y estilos existentes; evita introducir convenciones CSS incompatibles.

## Protección de código, Git y datos

- No elimines funcionalidades, archivos, pruebas, contratos, lógica de negocio o dependencias en uso sin autorización explícita.
- No reescribas módulos completos ni hagas refactorizaciones estructurales ajenas a la tarea.
- No sobrescribas trabajo ajeno ni cambios sin confirmar. No uses `git reset --hard`, `git clean -fd`, restauraciones masivas, `push --force` ni operaciones destructivas equivalentes.
- No cambies contratos públicos sin revisar todos sus consumidores y añadir compatibilidad o migraciones cuando proceda.
- No borres ni migres destructivamente datos, colecciones, documentos, IDs, historiales, reglas de seguridad ni configuración de producción. Las operaciones destructivas requieren aprobación explícita.
- Si detectas código obsoleto o una refactorización deseable, documenta la propuesta en el handoff; no la ejecutes automáticamente.

## Dependencias y algoritmos

1. Busca primero una solución existente dentro del repositorio.
2. Antes de desarrollar un algoritmo no trivial, evalúa librerías mantenidas y compatibles; compara documentación, licencia, tipos, dependencias, tests, mantenimiento y coste de integración.
3. Prefiere reutilizar, después integrar una librería adecuada mediante un adaptador y, por último, implementar desde cero con justificación.
4. No instales bibliotecas para resolver tareas triviales ni para imponer una arquitectura diferente.
5. Documenta la decisión técnica en el handoff; si no puedes verificar datos externos, indícalo.

## Ejecución y calidad

- Trabaja con cambios pequeños, incrementales y comprobables; conserva el comportamiento previo.
- Añade pruebas unitarias y de integración pertinentes; verifica estados vacíos, errores y casos límite.
- Ejecuta los scripts disponibles de lint, typecheck, tests y build después de los cambios. Distingue fallos preexistentes de regresiones y corrige las nuevas.
- No declares una tarea terminada solo porque compila o porque has escrito documentación.
- Si surge una operación peligrosa o un conflicto irresoluble sin riesgo, detén esa operación, documenta el bloqueo y sigue con tareas independientes seguras.

## Handoff y colaboración entre agentes

- Conserva y actualiza el handoff existente tras cada fase relevante: objetivos, decisiones, archivos cambiados, pruebas, resultados, bloqueos y próximos pasos.
- No crees handoffs paralelos sin necesidad. No marques tareas completas sin verificación.
- Revisa tareas pendientes antes de comenzar y continúa las compatibles con el alcance autorizado; no repitas trabajo realizado por otros agentes.
- Deja instrucciones precisas para que otro agente pueda retomar el trabajo sin reconstruir contexto ni descartar avances.

## Lista de control previa a cambios importantes

- ¿Existe ya una implementación reutilizable?
- ¿Respeto arquitectura, nombres, interfaces y estilo?
- ¿Conservo funcionalidades, datos, pruebas y cambios ajenos?
- ¿Es un cambio mínimo y compatible?
- ¿Puedo verificarlo con pruebas y comprobar regresiones?
- ¿Está documentada la decisión y actualizado el handoff?

> **EVOLUCIONAR, NO RECONSTRUIR · REUTILIZAR, NO DUPLICAR · AMPLIAR, NO SUSTITUIR · PRESERVAR, NO DESTRUIR.**

## Agentic Test Explorer y journeys adversariales

- Mantén las pruebas autenticadas limitadas a Firebase Auth/Firestore Emulator (`demo-tai-auth`, `127.0.0.1:9099`, `127.0.0.1:8080`) y a la app local `127.0.0.1:4187`. Identidades ficticias deben usar `@example.test`; nunca reutilices credenciales reales.
- Para recorridos repetibles usa el modo determinista `agent-explorer-batch --scenarios ...`; reserva Gemini para descubrir/generar escenarios nuevos. Conserva semillas, escenario validado, Action Tape, snapshots, capturas y resultado. No falsees aserciones para que pase un caso.
- El perfil (`fast`, `intensive`, `extreme`) selecciona profundidad por `min_profile`; no debe reducir las comprobaciones de los escenarios incluidos. Tras agotarse cuota, reutiliza planes guardados y continúa con ejecuciones deterministas sin modelo.
- Usa `TAI_AGENT_EMULATOR_ONLY=1` y la validación fail-closed del adaptador. No aceptes configuración de proyecto Firebase o endpoints que no sean los emuladores explícitos.

## Política de ejecución continua, pruebas extremas y finalización verificable

Esta sección complementa las reglas anteriores: terminar una iteración o una fase no significa terminar la tarea. Continúa con el siguiente trabajo ejecutable dentro del alcance y de los límites autorizados; no prometas ejecución indefinida ni continuación automática entre sesiones.

- Al iniciar o retomar un objetivo, consulta este archivo, el README y el handoff existente; revisa el estado de Git, los criterios de aceptación y el trabajo ya verificado. Conserva cambios existentes y evita repetir verificaciones actuales sin motivo técnico.
- Divide el objetivo en unidades comprobables, registra dependencias y avance en el mecanismo de seguimiento vigente, y usa estos estados: `PENDIENTE`, `EN PROGRESO`, `IMPLEMENTADO SIN VERIFICAR`, `COMPLETADO Y VERIFICADO` y `BLOQUEADO`.
- Al cerrar cada unidad, ejecuta sus verificaciones pertinentes, corrige fallos nuevos, actualiza el handoff y continúa con la siguiente unidad pendiente que pueda ejecutarse. Un informe de progreso no sustituye la implementación ni la verificación.
- No declares la tarea completa si quedan requisitos aplicables, pruebas pertinentes, defectos reproducibles, documentación, integración o verificaciones de aceptación pendientes. Solo marca `COMPLETADO Y VERIFICADO` cuando el handoff confirma que no queda trabajo ejecutable dentro del alcance.
- Si existe una dependencia externa, decisión de negocio o autorización imprescindible, investiga alternativas seguras, documenta el bloqueo y continúa las tareas independientes. No eludas controles de seguridad ni realices acciones fuera de las autorizaciones recibidas.
- Mantén el handoff como registro operativo: objetivo global, fases, estados, criterios, resultados reproducibles, errores, bloqueos, decisiones, archivos afectados y próximo paso exacto. Actualízalo tras hitos significativos y antes de cerrar una sesión de trabajo.
- Si el entorno impide completar el objetivo, conserva los cambios válidos y resultados, actualiza el handoff y comunica `PARCIALMENTE COMPLETADO`, con límites y siguiente acción. No presentes una iteración parcial como finalización global.
- Para pruebas prolongadas, exige aislamiento fail-closed verificado desde la configuración efectiva del cliente y el tráfico observado; que un emulador esté escuchando no basta. Si no se demuestra el aislamiento de Auth y Firestore, aborta sin ejecutar escrituras.
- Separa la generación opcional asistida por IA de la reproducción determinista. Presupuesta llamadas, tokens, concurrencia y reintentos; ante cuota agotada, detén generación y continúa con escenarios deterministas ya validados cuando sea seguro.
- No ejecutes ráfagas o estrés sin límites de acciones, tiempo, recursos y aserciones de integridad. Conserva semilla, secuencia, estado inicial y artefactos para reproducir fallos.

## Política obligatoria de auditoría, registro y corrección

Las auditorías de UX, accesibilidad, navegación, calidad y Agentic Test Explorer siguen el ciclo **DETECTAR → DOCUMENTAR → PRIORIZAR → CORREGIR → VERIFICAR → CERRAR**. Esta regla complementa las políticas de ejecución continua y no reemplaza las protecciones de negocio, datos o Firebase.

- Usa `tests/e2e/audit-findings.md` como registro canónico compartido entre UX y Agentic Test Explorer. Conserva `journey-audit-report.md` para contexto/evidencias de UX y `extreme-platform-status.md` para requisitos/estado de plataforma; enlaza hallazgos por ID y evita duplicar el mismo problema en listas divergentes.
- Cada hallazgo debe tener ID único, categoría/funcionalidad, descripción, evidencia, severidad/prioridad, causa identificada o probable, solución, archivos afectados, estado de implementación, pruebas y resultado final.
- Utiliza exclusivamente estos estados en el registro: `DETECTADO`, `ANALIZADO`, `PRIORIZADO`, `EN CORRECCIÓN`, `CORREGIDO SIN VERIFICAR`, `CORREGIDO Y VERIFICADO`, `BLOQUEADO` o `DESCARTADO, CON JUSTIFICACIÓN`.
- Documenta el comportamiento actual, el propuesto y sus consecuencias antes de cambios importantes de UX o arquitectura. No cambies reglas de negocio o pedagógicas sin requisitos verificados.
- Al corregir un hallazgo, conserva su ID e historial; ejecuta pruebas pertinentes, revisa regresiones, adjunta evidencia, actualiza el estado y continúa con el siguiente hallazgo ejecutable. Registrar o cambiar código por sí solos no permiten cerrar un hallazgo.
- Si una hipótesis no se confirma, conserva la evidencia y ciérrala como `DESCARTADO, CON JUSTIFICACIÓN`; no borres resultados anteriores ni rebajes aserciones para ocultar fallos.
- Antes de editar un registro compartido, inspecciona `git status` y su contenido actual. Añade entradas sin sobrescribir cambios de otra sesión. Si ATE descubre un posible problema de producto, enlaza su Action Tape/reproducción al ID TAI; si el problema es del framework, mantenlo también en el handoff de ATE y referencia su ID aquí.
- Actualiza este registro y el handoff pertinente tras cada hito. Al cerrar una iteración informa de hallazgos corregidos/verificados, pendientes y bloqueados, sin declarar completa una auditoría con flujos o pantallas no inspeccionados.

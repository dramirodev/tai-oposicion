# Auditoría e implementación planificada: estudio TAI hasta el examen

**Fecha de corte:** 2 de noviembre de 2026 (Europe/Madrid)<br>
**Checkout:** `main`, `2298c5f`, limpio al comenzar<br>
**Alcance:** investigación y especificación; no se han hecho cambios funcionales, escrituras de producción ni despliegues.

## 1. Resumen ejecutivo

TAI ya tiene piezas aprovechables para una experiencia de estudio —catálogo de preguntas y tarjetas, planificación diaria explicable, marcas de temas vistos, historial de intentos, repasos, señales de confianza, autoevaluación de recuerdo en papel, simulacros y checkpoint reanudable—, pero no compone aún un programa educativo completo desde el temario oficial hasta el examen. La planificación diaria es ejecutable como navegación a herramientas existentes; la actividad de contenido nuevo abre el índice del tema y remite al material en papel del estudiante. El sistema no dispone de apartados del programa enlazados a recursos, ni mide cobertura real de esos apartados.

Hallazgos prioritarios:

1. **No existe planificación global del programa.** El usuario elige manualmente un tema de introducción cada semana; los días restantes usan la rutina semanal y evidencia de temas marcados como vistos. La cuenta atrás no estima cobertura o riesgo de completar a tiempo. La próxima introducción no avanza automáticamente por el catálogo.
2. **El catálogo de la academia no coincide uno a uno con el programa oficial.** El índice local tiene 36 temas (`T1.01`–`T4.10`), 15.661 preguntas y 1.410 tarjetas. El programa AGE TAI de la convocatoria 2025 publicada en BOE contiene 33 temas; combina y reordena materias, mientras el catálogo divide dos temas oficiales y conserva `T1.06 Fuentes del Derecho`, que no aparece como tema independiente en ese programa. A fecha de corte, la prueba oficial de esa convocatoria fue el 23/5/2026. No hay convocatoria oficial de 2027 identificada ni seleccionada como objetivo.
3. **El estado pedagógico es grueso.** “Visto” es una declaración por tema, no cobertura por apartado; no separa pendiente, introducido, primera vuelta, comprensión y retención diferida. Las estadísticas objetivas se basan principalmente en preguntas; una evaluación de papel es autoinforme y solo existe por tema.
4. **La sesión diaria organiza pasos y cronómetro, no un ciclo de enseñanza/corrección completo.** Persisten el paso actual y el tiempo, pero no hay entidad de respuesta abierta evaluada, actividad de consulta selectiva enlazada a una sección ni registro unificado de pistas, confianza y corrección por sesión planificada.
5. **El calendario aún carece de agenda semanal fechada y reglas de simulacro.** Desde la auditoría se integraron excepciones con rango y eventos informativos; no hay bloques de pausa temporizados ni política de puntuación por hito. El periodo vacacional 2–5/11/2026 ya es histórico y queda solo como fixture reproducible.

Junio de 2027 se trata como **fecha objetivo editable del estudiante**, no como fecha oficial confirmada. Ajustes ya incluye `exam` y muestra esa advertencia; Planificación muestra 30/6/2027 como estimación de respaldo cuando no existe fecha configurada. **Aclaración del estudiante (2026-11-02, posterior a la auditoría): la aplicación tiene ahora una fecha marcada en junio.** Esto corrige cualquier interpretación de que la cuenta actual estuviera sin fecha configurada. El día/año exactos no se leyeron de su cuenta durante esta tarea y no se leyó Firestore; la fecha de la aplicación sigue siendo una configuración personal, no evidencia de publicación oficial.

## 2. Estado del repositorio y referencias

- Instrucciones revisadas: `AGENTS.md`, `README.md`, `src/features/planning/README.md`, scripts de `package.json`, y `firestore.rules` para autorización estática.
- `git status -sb`: `## main...origin/main`; HEAD `2298c5f Refactoriza accesos de progreso y componentes de estudio`. No había cambios locales al inicio.
- No se encontró un `HANDOFF.md`, `docs/` ni otro handoff separado entre los archivos markdown/versionados. El README de Planificación es el documento canónico más cercano para las reglas de producto y ya contiene metodología, límites y referencias. Se actualiza con un resumen/enlace a esta auditoría y la siguiente tarea; no se crea un segundo handoff.
- Tareas de proyecto consultadas: la migración de `legacy-store` figura abierta en el estado de trabajo, aunque el commit actual y pruebas confirman el módulo renombrado como `local-progress-store`; sigue siendo un asunto de mantenimiento fuera de esta auditoría. La tarea de motivos de acierto aparece completada. Ninguna se duplica aquí.
- CódigoGraph está disponible y se usó para localizar el flujo de `PlanningPage`, `buildDailyTrainingPlan`, `DailyTrainingSession` y sus enlaces.

### Evidencia y límites

Esta auditoría combina inspección estática, datos versionados localmente, pruebas automatizadas y recorrido UI E2E con fixtures locales. Las pruebas E2E simulan cuentas y la frontera Firebase; no son prueba de acceso a Firebase real. No se ejecutó una lectura remota, emulador con credenciales personales, escritura de producción ni despliegue.

Las referencias de líneas son al checkout auditado y pueden desplazarse en cambios posteriores.

## 3. Convocatoria oficial, catálogo y cruce de identificadores

### Programa y fecha oficiales comprobados

La fuente oficial más reciente localizada para el **Cuerpo de Técnicos Auxiliares de Informática de la Administración del Estado, ingreso libre** es la Resolución de 18/12/2025, BOE-A-2025-26262 (publicada 22/12/2025), Anexo V, apartado 3. Su programa está organizado como bloques I–IV con 9 + 5 + 9 + 10 temas = **33 temas**. La resolución de 12/3/2026, BOE-A-2026-6249, anunció el ejercicio para el 23/5/2026. Esa fecha ya pasó el día de esta auditoría. No prueba qué convocatoria preparará el estudiante para 2027; debe seleccionarse/confirmarse cuando exista la convocatoria pertinente.

La convocatoria 2025 establecía para el ejercicio de ingreso libre hasta 80 preguntas generales y un supuesto práctico de 20 preguntas elegido entre dos bloques, 120 minutos, preguntas de respuestas alternativas con una correcta, penalización de un tercio por error y blanco neutro (BOE, Anexo V, apartados 2.1–2.3). El simulacro de academia indicado por el estudiante —100 preguntas, 90 minutos— es un hito distinto; su regla de penalización no está identificada. El código actual usa un tercio para todos los cálculos (`src/core/domain/scoring.ts:1-4`), así que ese simulacro no debe mostrar una nota neta definitiva hasta conocer la regla que le corresponde.

### Catálogo local medido

`public/data/index.json` tiene 36 entradas (`temas`), y existen ficheros de preguntas y tarjetas por tema para las 36. La lectura local contabilizó 15.661 preguntas y 1.410 tarjetas. La academia distribuye así los identificadores reales y los datos disponibles:

| Identificador de TAI | Nombre del índice | Preguntas | Tarjetas |
|---|---|---:|---:|
| T1.01 | Constitución Española | 442 | 39 |
| T1.02 | Cortes Generales | 300 | 40 |
| T1.03 | Gobierno | 313 | 40 |
| T1.04 | Transparencia | 306 | 38 |
| T1.05 | TREBEP | 397 | 37 |
| T1.06 | Fuentes del Derecho | 213 | 38 |
| T1.07 | Políticas de Igualdad | 293 | 40 |
| T1.08 | Sociedad de la Información | 455 | 39 |
| T1.09 | Protección de Datos | 221 | 37 |
| T1.10 | Acceso Electrónico | 564 | 39 |
| T1.11 | Instrumentos de Acceso Electrónico | 244 | 37 |
| T2.01–T2.05 | Informática Básica; Periféricos; Estructuras de Datos; Sistemas Operativos; SGBD | 2.118 | 199 |
| T3.01–T3.10 | Modelo Entidad-Relación; Diseño de BD; Lenguajes de Programación; SQL; POO; Java y .NET; Arquitectura de Sistemas; Aplicaciones Web; Accesibilidad y Seguridad; Metodologías de Pruebas y Colaboración | 6.892 | 389 |
| T4.01–T4.10 | Administración de SO; Administración de BD y Virtualización; Administración del Correo; Administración de LAN; Seguridad CPD y Criptografía; Comunicaciones y Redes; Modelo TCP y OSI; Internet; Seguridad en Redes; Redes Locales | 2.903 | 398 |
| **Total** | **36 temas locales** | **15.661** | **1.410** |

La tabla agrega los bloques T2–T4; los datos individuales están en los ficheros homónimos `public/data/Tx.yy.json` y `public/cards/Tx.yy.json`. El índice y los ficheros prueban que hay preguntas/tarjetas asignadas, no que cada epígrafe del BOE tenga material, explicación correcta o fuente verificada.

### Cruce con los 33 temas del BOE-A-2025-26262

El mapeo es una aproximación por nombre/alcance, no una equivalencia certificada pregunta a pregunta. No se deduce que el repositorio contenga todos los epígrafes de un tema porque exista un fichero con ese nombre.

| Programa oficial 2025 AGE TAI | IDs de academia candidatos | Discrepancia / límite que debe conservar el mapeo |
|---|---|---|
| I.1 Constitución | T1.01 | El apartado oficial incorpora derechos, garantías/suspensión y Corona. Comprobar cobertura por epígrafe. |
| I.2 Cortes, Tribunal Constitucional, Defensor del Pueblo | T1.02 | Índice local nombra solo Cortes; la cobertura de TC y Defensor no se prueba por el nombre. |
| I.3 Gobierno | T1.03 | Candidato directo; verificar epígrafes y vigencia. |
| I.4 TREBEP, transparencia, Agenda 2030/ODS | T1.04 + T1.05 | Un tema oficial se divide en dos temas de academia; Agenda 2030 no aparece en nombre y necesita comprobar contenido. |
| I.5 Igualdad, violencia de género, igualdad LGTBI, discapacidad/dependencia | T1.07 | El nombre local es más estrecho; faltan verificar los subapartados expresos. |
| I.6 Sociedad de información, identidad/firma, DNIe, Agenda Digital | T1.08 | Candidato por nombre; la agrupación oficial exige cruce por apartado. |
| I.7 Protección de datos y derechos digitales | T1.09 | Candidato directo; comprobar los epígrafes actuales. |
| I.8 Acceso electrónico, tramitación, registros/notificaciones, ENS/ENI/NTI | T1.10 | Candidato amplio; comprobar cobertura de ENS/ENI/NTI. |
| I.9 Sedes, canales, identificación/autenticación, infraestructuras comunes | T1.11 | Candidato directo; comprobar cobertura por apartado. |
| II.1 Informática básica y arquitectura de ordenadores | T2.01 | Candidato directo. |
| II.2 Periféricos | T2.02 | Candidato directo. |
| II.3 Tipos abstractos, estructuras, ficheros, algoritmos y formatos | T2.03 | Candidato directo. |
| II.4 Sistemas operativos | T2.04 | Candidato directo. |
| II.5 SGBD relacionales, OO y NoSQL | T2.05 | Candidato directo; verificar las tres familias. |
| III.1 Modelado, entidades/relaciones, diseño lógico/físico y normalización | T3.01 + T3.02 | Un tema oficial se divide en dos IDs locales. |
| III.2 Lenguajes y construcciones de programación | T3.03 | Candidato directo. |
| III.3 SQL, procedimientos, eventos y disparadores | T3.04 | Candidato directo; verificar eventos/disparadores. |
| III.4 Orientación a objetos, patrones y UML | T3.05 | Candidato directo; verificar patrones/UML. |
| III.5 Java EE/Jakarta EE y .NET | T3.06 | Candidato directo; verificar versiones/contexto de vigencia. |
| III.6 Cliente-servidor/multicapas, servicios web y protocolos | T3.07 | Candidato directo; comprobar servicios/protocolos. |
| III.7 Aplicaciones web, front/back, HTML/XML, navegador y script | T3.08 | Candidato directo. |
| III.8 Accesibilidad, usabilidad y seguridad de desarrollo/puesto | T3.09 | Candidato por nombre; comprobar confidencialidad/disponibilidad y seguridad. |
| III.9 Repositorios, generación, documentación, metodologías, pruebas, versiones y colaboración | T3.10 | Candidato directo; comprobar cada subapartado. |
| IV.1 Administración de SO y software base | T4.01 | Candidato directo. |
| IV.2 Administración de BD, almacenamiento, backup, recuperación y virtualización | T4.02 | Candidato directo. |
| IV.3 Correo, contenedores y microservicios | T4.03 | El nombre del índice solo indica correo; cobertura restante no verificada por nombre. |
| IV.4 LAN, usuarios/dispositivos, monitorización/tráfico | T4.04 | Candidato directo; comprobar gestión de usuarios y tráfico. |
| IV.5 Seguridad, criptografía, CPD, incidencias y control remoto | T4.05 | Candidato por nombre; comprobar todas las materias. |
| IV.6 Medios/modos, equipos, redes y comunicaciones inalámbricas | T4.06 | Candidato amplio. |
| IV.7 TCP/IP y OSI | T4.07 | Candidato directo. |
| IV.8 Internet, arquitectura, servicios, HTTP/HTTPS/TLS | T4.08 | Candidato directo. |
| IV.9 Seguridad de redes, perímetro, acceso remoto, VPN y puesto | T4.09 | Candidato directo. |
| IV.10 Redes locales, topología, transmisión, acceso e interconexión | T4.10 | Candidato directo. |

`T1.06 Fuentes del Derecho` no es un tema autónomo del programa TAI de 2025; conservarlo en el catálogo académico, pero marcarlo como **sin correspondencia oficial validada** para esa versión hasta confirmar dónde lo sitúa el material de academia. No borrarlo ni tratarlo como tema oficial por deducción. Para una futura convocatoria, almacenar su texto/versionado como otra edición del currículo. Los 18 códigos declarados vistos a 2/11/2026 coinciden en nombre e identificador con el índice local (`T1.01`–`T1.06`, `T2.01`–`T2.05`, `T3.01`–`T3.07`). Esto confirma correspondencia del catálogo local, no la cobertura de sus subapartados ni autoriza a sobrescribir marcas posteriores.

## 4. Matriz de capacidades actuales

| Capacidad | Estado | Recorrido, persistencia y evidencia | Pruebas / límites |
|---|---|---|---|
| Catálogo de temas/preguntas/tarjetas | Parcial | `public/data/index.json` → `study-question-catalog` → tests, simulacros y estadísticas; JSON versionado por topic ID. Tarjetas curadas en `public/cards/index.json` y ficheros por tema. Conteo estático reproducible (2/11/2026): 36 temas, 15.661 preguntas en metadatos/JSON no sustituidas y 1.410 tarjetas utilizables; los 36 temas tienen al menos una de cada una. `public/explanations/index.json` relaciona 5 explicaciones con T3.03, todas `draft`, 0 `reviewed`. | No hay manifiesto de epígrafes oficiales con enlaces de material/resumen. Las explicaciones `draft` no son contenido verificado. El inventario versionado no demuestra disponibilidad remota, vigencia de fuentes ni cobertura del programa oficial. |
| Marcar tema como visto | Parcial | `TopicsView`/servicios de progreso → `seenTopics` y marca agregada local; con cuenta aprobada puede sincronizarse. | Test de temas y flujo de planificación existen. Marca por tema, no por apartado; significa declaración, no lectura, comprensión o dominio. |
| Plan global hasta examen | Parcial (integración local posterior) | `PlanningHorizon.tsx` consume objetivo, orden explícito, catálogo local, marcas agregadas, preferencias semanales y eventos de disponibilidad; `study-planning-horizon.ts` ajusta los espacios de contenido nuevo por fecha. | No consulta preferencia remota; usa la cargada por runtime. No estima esfuerzo, cobertura por apartado, aprendizaje/retención ni horas factibles. Los hitos aún no son reglas de simulacro. La fecha oficial aplicable al objetivo futuro sigue sin identificarse. |
| Plan semanal | Parcial | `TrainingPreferences` guarda patrón recurrente y `calendarEvents`; Ajustes permite ausencias/vacaciones, presupuesto/franja especial, clases e hitos. `resolveTrainingDay` aplica excepciones por fecha sin mutar la rutina. | No hay agenda completa con inicio/fin de bloques de foco y pausas. Clase e hito son informativos. Ventana especial acepta hasta 360 min enfocados, pero el checkpoint diario no los subdivide en bloques ni pausa automáticamente. |
| Selección de tema nuevo | Parcial | `app-services-composition.ts:588-611` obtiene el tema elegido si no está marcado como visto y lo pasa a `buildDailyTrainingPlan`; `study-training-plan.ts:128-145`. | No sigue el orden real de academia ni sugiere el siguiente tema automáticamente. Si no se eligió tema, la sesión puede quedar vacía. Plan new-content solo en días configurados `new-content`. |
| Sesión diaria concreta | Parcial | `buildDailyTrainingPlan` entrega tipos de actividad, minutos, motivo y topic IDs; `resolvePlannedActivityAction` abre `temario`, `cards`, `test` o `falladas` (`planning-controller.ts:10-43`). | Actividades son rutas ejecutables, pero `newContent` apunta al índice del tema y exige consulta de apuntes externos. No hay subtema/material asociado ni pasos de ejemplo/corrección integrados. |
| Pausar, retomar, recargar sesión diaria | Parcial | `DailyTrainingSession` conserva índice, hora actual, tiempos por actividad; `training-session-composition.ts:37-60`; localStorage por cuenta (`adapters/local/training-session.ts:9-10,104-155`); push opcional a `users/{uid}/cfg/training`. | Unit tests de sesión/adaptador validan inicio/pausa, checkpoint, historial y merge. E2E de plan valida inicio/retorno tras leer; no encontramos E2E plan que pause, recargue y compruebe tiempo/evite doble cierre. E2E genérico sí prueba persistencia/recarga de test activo. |
| Historial de sesión diaria | Parcial | Al completar todos los pasos se archiva un resumen, ID por fecha, últimos 30 (`study-training-session.ts:26-49`; adaptador `training-session.ts:28-79`). | Resume actividades y tiempo, no respuestas, correcciones ni evidencias pedagógicas. Completar un checkpoint no implica completar todos los objetivos de aprendizaje del tema. |
| Corrección y feedback de preguntas | Parcial | Quiz/Test almacena intentos/estadísticas; muestra solución y explicación disponible. Modo simulacro difiere corrección al final. | Fixtures de E2E verifican respuesta/corrección y simulacro sin feedback previo. La explicación puede faltar o estar obsoleta. No existe evaluación objetiva de respuestas abiertas. |
| Explicaciones y fuentes | Parcial / remoto no verificado | `ExplanationRepository`, `explanations.ts` y `http/explanation-repository.ts:8-24`; cada explicación de código tiene `draft|reviewed`, revisión por `contentRevision`, pasos, distractores, limitación y fuentes. Se carga desde `explanations/index.json`, a través de fuente Firebase autenticada según comentario del adaptador. Inventario local: 5 borradores vinculados a T3.03; ninguno revisado. | No hay explicador general por epígrafe. La existencia de schema no prueba cobertura o exactitud de explicaciones remotas. No se leyó Firebase. Un E2E offline de explicación draft ha fallado; diagnóstico pendiente. |
| Preguntas con origen | Parcial | `Question` tiene origen/fuente y la interfaz muestra etiquetas; filtros de test permiten origen. | Banco local tiene datos versionados; no se revisaron individualmente 15.661 referencias. No garantizar vigencia oficial o cobertura completa. |
| Temas débiles/dominio | Parcial | `topic-mastery.ts:44-101` calcula sobre preguntas únicas respondidas, precisión de último resultado, cobertura frente a 60% del banco local, mínimo 5 intentos y recencia 14/30 días; solo temas vistos pasan a estadísticas (`filterTopicMasteryToSeen`). | Buen límite: repetir inmediatamente un mismo ítem no aumenta el numerador de preguntas únicas. Riesgo: `attempts` total sirve como umbral aunque sean repetición de pocas preguntas; estado verde indica umbral/precisión/cobertura/recencia del banco, no retención diferida. Los parámetros son heurísticas locales. |
| Confianza/duda | Parcial | Campos `doubtful` y confianza/discarded options en intentos de preguntas; análisis separado. | Autoinforme opcional; no sustituye corrección objetiva ni evalúa texto libre. |
| Papel / autoevaluación | Parcial | `paper-recall-assessment.ts:3-67`: `remembered/partial/not-remembered`, por tema/día, con prioridad heurística de 30 días; guarda localmente y sincroniza por cuenta si disponible. | No requiere transcribir test completo; no recoge sección ni nº de preguntas, aciertos/errores, dudas o plantilla. No es medida objetiva; UI y E2E verifican persistencia local simulada. |
| Repaso espaciado | Parcial | `ts-fsrs` instalado y FSRS para tarjetas configuradas; preguntas con fechas de repaso y fallos recurrentes. `spaced-repetition.ts` define intervalos legacy 2/5/14/30/60; prioridad de vencidas y selección intercalada por tema. | Hay más de un calendario/representación; la heurística temporal actual no es un parámetro universal ni aplica FSRS a la cobertura completa por apartado. Repasos se limitan a temas vistos para no marcar tema no estudiado como error. Exceso no tiene política basada en presupuesto global. |
| Agenda/calendario | Parcial | `study-training-calendar.ts` y adaptador gestionan repasos; `study-training-events.ts` valida excepciones en preferencias; Ajustes crea/borra y `StudyCalendar`/horizonte muestran fechas afectadas. | E2E local confirma regla por fecha, recarga y vuelta al horario al expirar. No prueba Firebase. Hitos no tienen política de nota; no redistribuye pendientes ni genera bloques de pausa. Eventos pasados se conservan hasta eliminación manual y no contaminan el siguiente plan. |
| Simulacros/historial | Parcial | `SimulationPage`, selección de catálogo/exámenes, cronómetro, checkpoint de intentos, resultados/estadísticas; E2E prueba corrección al finalizar y reanudación. | No hay evento “hito intermedio/final” con versión, fecha y reglas por examen. La nota actual usa -1/3 global; no soporta explícitamente penalización desconocida. La configuración del usuario de 100/90 no se verificó en cuenta real. |
| Persistencia local/sync | Parcial; backend no verificable | Progreso local, IndexedDB/LocalStorage adapters, sesiones/calendario/recuerdo y adapters Firebase; sincronización por cuenta. Rules de `firestore.rules` hacen cumplir scope de `uid` para recursos `users/{uid}` y nivel aprobado donde corresponde. | Inspección estática y tests de reglas del repositorio no prueban reglas desplegadas, acceso efectivo ni datos personales. No se usaron credenciales ni hubo lecturas/escrituras reales. |
| Accesibilidad/UI responsive | Parcial / E2E local | Controles semánticos, roles, tamaños de interacción, enfoque y layouts responsive; `tests/e2e/css-ui.spec.ts` cubre planificación, Ajustes móvil/escritorio e historial. | E2E ejecutado en Chromium con datos simulados. No se hizo prueba con lector de pantalla ni dispositivo iOS físico en esta tarea. |

### Recorrido actual resumido

`Inicio/Planificación → HomeServices.loadOverview → preferencias + índice + preguntas vencidas/falladas + tarjetas vencidas → buildDailyTrainingPlan → sesión/checkpoint local (sync opcional) → route existente → resultado/estado de progreso → regreso a Planificación`.

La lectura y explicación suelen quedar fuera del recorrido instrumentado; el tipo `newContent` conserva minutos/motivo/topic ID, no el material ni un estado del ciclo. Es posible pausar el cronómetro diario, pero una respuesta/pista no crea automáticamente una etapa posterior de corrección o recuperación por sección. La planificación no recalcula todo el calendario por respuesta; vuelve a cargar evidencia y rutina cuando se abre el overview.

## 5. Ciclo educativo propuesto y escalas de planificación

### Modelo mental y de datos

Separar explícitamente tres objetos:

1. **Currículo versionado**: edición oficial/academia, fuente primaria, convocatoria/ámbito, vigencia, bloques, temas, apartados con IDs estables, texto del epígrafe y relaciones muchos-a-muchos con IDs de academia/material/preguntas. No modificar IDs existentes; añadir claves de correspondencia versionadas y estado `confirmed|candidate|unmapped` con procedencia.
2. **Avance por tema/apartado**: estado de avance `pending|introduced|in-progress|first-pass-complete` independiente de señales de aprendizaje. Cobertura parcial explicitada; observación de clase futura, cambio de orden y fuente/fecha de dato. Una actividad de aprendizaje nuevo para `pending` no se contabiliza como repaso fallido.
3. **Evidencia de aprendizaje** por apartado: tipo de intento (asistido, inmediato, diferido, papel, práctica), pregunta/material y revisión, respuesta o valoración acotada, uso de pista/consulta, duda/confianza opcional, resultado de corrección (objetivo o autoevaluado), fuente/versión, tiempo activo, fecha y sesión. No combinar señales distintas en una puntuación de “dominio” sin definición y datos suficientes.

Los datos personales y el checkpoint deben conservar aislamiento y compatibilidad con localStorage/IndexedDB y el DTO histórico de Firebase. Añadir esquema versionado, migración aditiva tolerante a registros anteriores, lectura dual durante transición y rollback lógico; nunca borrar ni reescribir progreso histórico. Extender validadores actualmente limitados a `T[1-4].nn` y el límite de 36 temas de manera que identificadores nuevos vengan del catálogo, no de condicionales de código por tema.

### Horizonte completo hasta el examen

1. Usuario selecciona currículo oficial/academia y ámbito; sistema muestra fuente, versión, fecha oficial conocida o “sin confirmar”, y objetivo personal editable. La fecha de junio de 2027 es provisional.
2. Se compara el total de apartados con sus estados de avance/evidencia, no solo los 18 temas declarados vistos. Se identifica contenido nuevo, apartados parcialmente cubiertos, comprobaciones diferidas, errores persistentes y secciones sin material.
3. El plan calcula capacidad disponible restante con semanas laborables, descansos y excepciones fechadas; no asigna horas de las 08:00–15:00 como estudio continuo. Muestra brecha/escenarios (más tiempo sostenible, extender fecha, priorizar material/cobertura mínima con coste visible), no probabilidad de aprobar.
4. Fechas de simulacro se guardan como hitos tipados y versionados (`intermediate|full|final`), con fecha, alcance curricular y política de puntuación. El del 5/11/2026 se conserva como hito intermedio de temario visto/academia, no como filtro de la preparación total. Después del 5/11 su estado pasa a celebrado/vencido y se mantiene su historial; se elimina solo de “próximos” sin borrar la definición ni crear una excepción permanente.
5. No se promete resultado. La carga de cada fase se ajusta por cobertura y resultados diferidos; aprendizaje nuevo, repasos, mezcla y simulacro pueden convivir.

**Escenario ilustrativo, no lectura de la cuenta:** entre 2/11/2026 y la fecha fallback 30/6/2027 hay unos 240 días (34 semanas). El estudiante confirma posteriormente que tiene una fecha marcada en junio; el día/año exactos no están disponibles en esta auditoría. La disponibilidad usual declarada de 2 h/día representa un presupuesto bruto; descansos, trabajo, vacaciones, clases, ausencias y tiempo de corrección reducen el tiempo de estudio efectivo. El programa oficial vigente para la próxima convocatoria y los minutos reales por apartado no están confirmados, así que no es responsable afirmar que la fecha configurada de junio es matemáticamente suficiente. El motor debe calcularlo al disponer de esos inputs y exponer rangos/escenarios.

### Semana

- Reutilizar `TrainingPreferences`, `study-training-plan.ts`, `study-training-calendar.ts` y `StudyCalendar` ampliando entradas/salidas, sin reemplazar la feature.
- Semana propone temas/epígrafes en el orden comunicado por academia (configurable cuando la academia cambie el orden), pone tiempo para repaso diferido y nuevo material, y reserva disponibilidad/descanso por persona.
- Arrastrar una tarea perdida a una cola ponderada por urgencia/cobertura/tiempo disponible; no acumularla toda para mañana, ni marcarla como fallo. El mismo evento no se reprograma de forma imprevisible después de cada respuesta: recalcular en límites estables (fin de sesión, cambio de disponibilidad, hito/semana) y explicar cambios.
- El estudiante puede registrar clase futura, vacaciones, ausencia, festivo o día con menos energía y replanificar confirmando una propuesta. Los cambios de agenda no borran evidencia ni sesiones.

**Ejemplo de incorporación nueva:** “Políticas de Igualdad” está en el índice real como `T1.07`, tiene preguntas y tarjetas locales, y es el siguiente tema mencionado por el estudiante; la lista de vistos confirmada a 2/11/2026 termina en `T1.06` para el bloque T1. En el sistema actual hay que elegir `T1.07` en Ajustes: sin esa selección, el plan no prepara automáticamente la entrada aunque el ID exista. La sesión debe tratarlo como `pending`, remitir a los apartados/material del currículo elegido (hoy no están vinculados) y no añadir fallos/retrasos hasta que haya primer contacto. El cruce provisional 2025 lo relaciona con bloque I, tema oficial 5, pero exige comprobar los subapartados LGTBI, violencia, discapacidad y dependencia; no afirmar cobertura completa a partir del nombre.

**Ejemplo de repaso de tema anterior:** `T3.04 SQL` está en los IDs confirmados como vistos. Si hay evidencia de error en una pregunta de `T3.04`, la sesión abre una comprobación no asistida del apartado/pregunta relacionado, permite duda o pista opcional, corrige con fuente/revisión y agenda una prueba diferida. Si no hay error ni apartado identificado, puede usar una pregunta o tarjeta de recuperación existente sin crear retrospectivamente cobertura de todos los epígrafes de SQL.

### Sesión y ciclo de una actividad

1. **Empezar con una acción preparada.** Si el apartado ya se estudió: pregunta abierta breve o recuperación sin pistas. Si es nuevo: explicación/resumen breve y ejemplo, citados/enlazados a una versión real del material; si no hay contenido fiable, mostrar “material no disponible” y ofrecer registrar estudio externo, sin inventar.
2. **Consultar solo una laguna**: referencia exacta a tema/apartado, versión/fecha y fuente; anotar consulta como asistida. No premiarla como respuesta independiente.
3. **Explicar o aplicar**: pedir reconstrucción breve, comparación, ejemplo nuevo o problema apropiado al contenido. Respuesta abierta puede registrarse como autoevaluada por persona; separada de “correcta” objetiva.
4. **Practicar**: selección de pregunta abierta, comparación, problema/test según tipo de contenido. Test explica respuesta y distractores con fuentes si disponibles; ambigüedad/posible error del banco se puede marcar y excluir de puntuación automatizada hasta revisión.
5. **Cerrar intento**: guardar respuesta una vez con ID idempotente, corrección, pista/consulta, confianza opcional, fuente/revisión y resultado. Acierto inmediato no crea memoria diferida; agenda una comprobación posterior adaptada al horizonte y resultado.
6. **Pausar/reanudar** conserva paso, respuestas ya registradas, reloj activo, versión de la sesión y checkpoint. El doble envío del mismo ID no crea dos resultados. Retomar no vuelve a servir un ítem respondido salvo reintento explícito identificado.
7. **Cerrar** produce resumen corto: apartado trabajado, errores/preguntas dudosas, siguientes repasos programados, tiempo y siguiente acción. El usuario puede corregir una autoevaluación con nueva marca sin sobrescribir intento objetivo.

Las tarjetas FSRS existentes son el primer motor de repetición a evaluar/reutilizar; ya se usa `ts-fsrs`. Mantener un adaptador `ReviewScheduler` para tarjetas y nuevas evidencias por apartado si las superficies de FSRS cubren sus necesidades. Comparar ese enfoque con la agenda legacy de preguntas antes de adoptar intervalos; no sumar otra lista de 2/5/14/30 días como “verdad científica”. La regla debe usar resultado asistido/inmediato/diferido, fecha de objetivo, contenido ya estudiado, límite diario de carga y evidencias con suficiente estabilidad. Si no hay historial, el primer contacto es aprendizaje nuevo; ausencia de recursos produce un estado accionable, no falso “repaso”.

### Ejemplo de sesión ordinaria de 120 minutos

Plantilla ajustable para un día fatigado; no constituye dosis universal:

| Minutos | Actividad | Evidencia buscada |
|---:|---|---|
| 0–25 | Recuperar un apartado estudiado (p. ej. SQL) sin apuntes | Respuesta y duda/confianza opcional |
| 25–35 | Corregir, explicar error/acierto dudoso y anotar laguna | Resultado objetivo con fuente/revisión |
| 35–40 | Descanso fuera de pantalla | Recuperación/pausa |
| 40–70 | Tema nuevo según orden real de academia; explicación + consulta selectiva del material | Cobertura parcial por apartado; versión de fuente |
| 70–80 | Descanso | Pausa real, no pregunta adicional |
| 80–100 | Explicar con palabras propias o resolver ejemplo distinto | Texto del estudiante o autoevaluación identificada |
| 100–115 | Práctica aplicada (no una tanda larga por defecto) | Intentos con feedback y distractores |
| 115–120 | Registrar siguiente comprobación y cierre | Repaso diferido agendado, sin inflar dominio |

La primera fase no clasifica un tema nuevo como olvidado. Si el usuario solo tiene 15–30 min antes del trabajo, se puede dividir la sesión en dos checkpoints de la misma versión: microbloque matinal de recuperación/activación y bloque vespertino de consulta, ejemplo y práctica. La preferencia no debe multiplicar el número de decisiones de inicio.

### Ejemplo temporal de vacaciones 2–5/11/2026 (08:00–15:00)

Excepción activa en la fecha de corte; debe almacenarse con fecha inicio/fin y extinguirse el 6/11 sin tocar la rutina ordinaria. No interpretar siete horas de ventana como siete horas de estudio. Día demostrativo: 08:00–09:15 recuperación/corrección; descanso 15 min; 09:30–10:45 tema nuevo/material/ejemplo; pausa 30 min; 11:15–12:30 práctica mixta y revisión; comida/paseo 60 min; 13:30–14:15 repaso ligero o test de papel; 14:15–15:00 libre para cierre, margen o descanso. Son 4,5 h de bloques de estudio espaciados dentro de una ventana de 7 h, ajustables tras observar energía y clase; no una prescripción clínica ni una agenda permanente.

### Contenido/explicación y banco de papel

- **Brecha de contenido:** el repositorio contiene índice de temas, bancos de preguntas, tarjetas y algunas explicaciones de código. `PlanningPage.tsx:309` confirma que esquemas/resúmenes completos no están incluidos. No hay corpus de apartados ni documentos de academia enlazados por sección. Toda respuesta explicativa debe mostrar procedencia/revisión o marcarse como borrador; no atribuir fuentes inexistentes.
- **Brecha de práctica en papel:** permitir registrar lote/tema/secciones, fuente/test, fecha y cantidades opcionales (respondidas, correctas, erróneas, blancas), corrección disponible/no disponible, dudosas y motivo; aceptar un mínimo rápido de “lo hice, estas secciones me costaron” sin transcribir preguntas. Fuente `paper/self-report`, no misma semántica de un intento calculado por TAI. OCR no está justificado: el usuario ha dicho que no puede identificar los tres tests pendientes; no hay PDFs concretos, permiso de procesarlos ni beneficio que justifique su coste.

### Contexto individual y fundamento

La declaración de atención habitual entre 25–45 minutos sirve para iniciar bloques ajustables, no diagnostica ni define un umbral obligatorio. El ejemplo de comprensión mediante ejemplos técnicos y aciertos inmediatos acredita solo una observación breve de comprensión/recuperación a corto plazo; no demuestra retención días después ni un estilo de aprendizaje. El producto debe observar resultados en contextos distintos antes de adaptar recomendaciones. La preferencia por avanzar, el cansancio tras el trabajo y la dificultad de inicio justifican por decisión de producto una acción predeterminada breve, reentrada sin culpa y cola limitada; su efecto se debe validar con uso, no se atribuye a un tratamiento clínico. No hay diagnóstico confirmado de TDA; no se diseña con esa premisa. La revisión de Dunlosky respalda con límites la práctica de recuperación y distribución temporal; Pashler se usa para no asignar “estilos” de instrucción. Esas conclusiones generales no prueban la eficacia de esta interfaz para este estudiante.

## 6. Backlog de implementación por fases

Los tamaños son relativos (**S/M/L/XL**) e inciertos; no son plazos. El tamaño puede cambiar al concretar acceso a materiales y alcance del próximo currículo oficial. Ninguna fase se implementa en esta auditoría.

### Fase 1 — Corrección integrada, continuidad e inicio fiable (L)

**Prerequisito P0 antes de ampliar Planificación:** reparar el shell offline observado en `npm run test:e2e`: el HTML solicita `startup-theme.js`, pero `public/sw.js:SHELL` no lo precarga; las pruebas fallan cuando recargan sin red. Añadir el recurso al shell/versionar caché según el patrón del proyecto y validar primera instalación + recarga offline en Chromium y WebKit. No es una inferencia de corrección pedagógica; es una incidencia de disponibilidad PWA reproducida por cuatro fallos de dos escenarios.

- **Problema:** plan diario no ejecuta un ciclo medible y falla el vínculo entre paso planificado, feedback, checkpoint y futura repetición.
- **Reutilizar:** `PlanningPage`, `study-training-session.ts`, `training-session-composition.ts`, `local/training-session.ts`, gateway de progreso, `AttemptRepository`, `AttemptTracker`, `QuizPage`, componente de feedback actual, `paper-recall-assessment.ts`, `pending-run`.
- **Cambios:** convertir pasos existentes en ciclo de actividad con `stepId`, `curriculumItemId?`, `sourceRef?`, estado `ready|active|paused|completed|blocked`, resumen; registrar intentos con idempotency key, pistas, respuesta/confianza opcional, feedback y source/content revision; la siguiente acción vuelve clara al retornar. Registrar inicio/corrección/cierre con sesión versionada. Mantener ruta actual como fallback para material externo.
- **Datos/migración:** añadir esquema versionado aditivo, decoder/migrador desde `DailyTrainingSession` actual; conservar progreso DTO/IDs y los 30 resúmenes existentes. No migrar ni borrar sesiones/Firestore; una sesión vieja se presenta como checkpoint legacy hasta terminar o expirar por política transparente.
- **Riesgos/dependencias:** coordinación test/planificación; curso de una pestaña versus multi-dispositivo; minimizar datos sincronizados. No contar apertura de índice como sesión completada; no duplicar al doble click o reload.
- **Aceptación/pruebas:** start → answer → correction → pause → reload → resume → close en desktop/móvil; red offline/reconexion; doble envío; cambio de cuenta; actividad no disponible; answer ya completada no se repite; historial retiene fuente/tiempo; error de persistencia recuperable. Screen reader y foco comprueban controles de feedback.

### Fase 2 — Currículo/versiones, apartados y materiales (XL; dependiente de Fase 1 para registrar evidencia)

- **Problema:** 36 IDs de academia no representan de modo completo ni inequívoco los 33 temas de la convocatoria 2025; tema versus apartado no está modelado.
- **Reutilizar:** `studyQuestionCatalog`, `public/data/index.json`, `Topic`, `QuestionRecord`, repo HTTP/banco cache, `ExplanationRepository`, etiquetas de origen y navigation routes.
- **Cambios:** añadir paquete/manifiesto de currículo versionado con fuente oficial, convocatoria, ámbito (ingreso libre/promoción), bloques y apartados; tabla versionada de equivalencia de temas academia con `candidate/confirmed/unmapped`, justificación y fecha; estado de material y tipo de fuente. Enumeración dinámica desde el índice, no regex por rangos de código.
- **Datos/migración:** IDs actuales son claves legacy estables; crear equivalencias many-to-many sin reetiquetar el histórico. Migrar marca de visto únicamente como estado de tema declarado; no inferir cobertura de todos sus apartados.
- **Riesgos/dependencias:** obtener/anotar material legalmente utilizable de academia y convocatoria pertinente a 2027; ambigüedad entre examen personal, versión del programa y nuevas actualizaciones. Revisión editorial de las correspondencias y contenido, no generación implícita.
- **Aceptación/pruebas:** todo epígrafe oficial tiene fuente; los enlaces faltantes salen como “sin material”; pregunta/card enlazada a apartado lleva procedencia y versión; incorporar un tema 19 y T5 nuevo con datos solo, no código; discrepancias de orden, combinación y separado; actualizar programa invalida referencias obsoletas sin perder datos personales.

### Fase 3 — Horizonte, semana y disponibilidad adaptativa (L/XL)

- **Problema:** solo hay rutina semanal y citas manuales de repaso; no conoce capacidad hasta objetivo, turnos, descanso, clase futura, festivo, vacaciones ni simulacro intermedio.
- **Reutilizar:** `TrainingPreferences`, `buildDailyTrainingPlan`, `study-training-calendar.ts`, `StudyCalendar`, Ajustes, `HomeOverview`, session history.
- **Cambios:** `PlanningInputs` para objetivo (official/personal/unknown + source/version), capacidad por bloques horarios/días/energía opcional, eventos de ausencia, academia order y `ExamMilestone`; reporte semanal de cobertura por apartado y horas restantes/escenario. Algoritmo de prioridad explicable y configurable por restricciones; plan snapshot estable por semana/sesión, actualizar ante cambio explícito o checkpoint definido.
- **Datos/migración:** sumar propiedades opcionales con valores derivados de preferencias de 120min y fecha existente; no escribir estados a cuenta real en pruebas; conservar evento 5/11 como hito histórico/provisional, no excepción permanente.
- **Riesgos/dependencias:** sin esfuerzo estimado/material no se puede pronosticar cobertura. Mostrar intervalo/escenarios y brecha, nunca probabilidad de aprobado o agenda inviable. Replanificación requiere revisión/confirmación, no sobrescribir histórico.
- **Aceptación/pruebas:** 240 días a objetivo editable, objetivo desconocido/cambiado; volumen pendiente y plan inviable; vacaciones 2–5/11 con regreso 6/11 a rutina; semanas de ausencia/festivos; reorden de academia; 5/11 celebrado pasa a histórico y 6/11 sigue plan completo; excesos de repaso no bloquean tema nuevo; se ofrece descanso.

### Fase 4 — Agenda de revisión adaptativa y señales diferenciadas (L)

- **Problema:** tarjetas FSRS y repaso legacy conviven, pero no se distingue de manera sistemática respuesta asistida/inmediata/diferida por apartado.
- **Reutilizar:** `ts-fsrs`, `CardProgressGateway`, adaptador de FSRS, `spaced-repetition.ts`, métricas de intentos, `AttemptRepository`, historial.
- **Cambios:** comparar contrato actual FSRS vs agenda de preguntas; un `ReviewScheduler` determina due dates con evidencia no asistida y horizonte de evaluación; guardar razón observable. Desacoplar `mastery` de las etiquetas actuales “green/weak”. Excluir contenido nuevo de cola de repasos hasta la primera vuelta. Presupuestar límite diario con backlog envejecido sin acumulación punitiva.
- **Datos/migración:** conservar campos actuales y calibrar nuevos `scheduledReview` sin sobreescribir `dueAt` legacy; asociar `schedulerVersion`. Volcado comparativo sin cambiar datos primero.
- **Riesgos/dependencias:** FSRS estimó con tarjetas y grades existentes; extrapolarlo a apartados/temas no está validado. No afirmar optimalidad. La autoevaluación y acierto con pista no alimentan la misma métrica que una respuesta diferida sin ayuda.
- **Aceptación/pruebas:** acierto en primer intento vs repetido inmediatamente; respuesta con pista; nueva comprobación tras días; error repetido; sin historia; ítem erróneo/ambiguo queda en cuarentena; límite de carga, cambio de fecha y calendario DST.

### Fase 5 — Materiales guiados, simulacros y métricas (M/L)

- **Problema:** sin secciones/materiales generales, papel y métricas de cobertura completa; simulacro no distingue una política incompleta.
- **Reutilizar:** `ExplanationRepository`, tipos `CodeExplanation`, `paper-recall-assessment`, `SimulationPage`, `scoring.ts`, `StatsPage`, `AttemptArchive`, `QuestionSources`.
- **Cambios:** ficha de recurso por sección con revisión/fuente; registro rápido de test en papel; modos `learning` con corrección integrada y `simulation` con feedback diferido; `ScoringPolicy` por hito con acierto, blanco y penalización configurables, source/version/status. Mostrar neto solo cuando política completa; reportar correct/incorrect/blank junto con escala/transformación.
- **Datos/migración:** no cambiar histórico `nota`; guardar `policyId` y snapshots nuevos. Referencias de fuente son URLs oficiales o artefactos locales versionados. Mantener respuesta abierta como autoevaluación separada.
- **Riesgos/dependencias:** trabajo editorial y aclarar scoring del simulacro de academia. Evitar nota de simulacro no comparable con llamada oficial. Métricas por etapa no son estimadores de aprobabilidad.
- **Aceptación/pruebas:** scoring unknown/incomplete; parámetros oficiales o de academia versionados; blank/correct/wrong; parcial de papel sin transcripción; fuente ausente, vencida o draft; explicación de distractor; pregunta anulada; corrección solo al final en simulacro; navegación a fuente accesible.

### Fase 6 — Refinamiento, accesibilidad y evaluación del producto (M)

- **Problema:** métricas no evalúan si el ciclo reduce fricción o mantiene el estudio sin culpa/sobrecarga; el E2E detecta un fallo offline actual.
- **Reutilizar:** telemetría local/exportación manual ya existente, tests UI y componentes accesibles.
- **Cambios:** medir embudo “abrió → inició → pausó/retomó → corrigió → repaso diferido” con consentimiento/retención mínima; revisar estados vacíos/errores y resultados; considerar auditoría manual WCAG y evaluación de usabilidad, no añadir analytics remoto por defecto.
- **Datos/migración:** usar agregados anónimos/locales si usuario decide exportar; nunca enviar progreso por defecto.
- **Aceptación/pruebas:** estados sin materiales/historial/red, texto grande, teclado/foco, móvil/escritorio, carga cognitiva; diagnóstico y corrección del fallo de E2E offline explicaciones antes de declarar PWA validada.

## 7. Casos de comportamiento para las fases

| Caso requerido | Comportamiento/resultado que debe probarse |
|---|---|
| Temario completo | Recorrer todos los apartados de versión seleccionada; ninguno se infiere cubierto por leer índice. Mostrar material ausente. |
| Tema 19 y siguientes | Entran por catálogo/currículo/datos dinámicos; sin nuevos condicionales ni regex T1–T4. |
| Cobertura parcial | Cada apartado puede quedar parcial; progreso agregado explica denominador/fuente. |
| Orden de academia no secuencial | Plan usa orden editable/versionado; no ordenar por código. |
| Convocatoria y fecha desconocidas/modificadas | Fuente no confirmada visible; objetivo personal editable conserva distinción; fechas antiguas quedan versionadas. |
| Tiempo insuficiente | Brecha horaria con inputs/assumptions, escenarios y coste; no llena más de la disponibilidad ni promete aprobar. |
| Semana de vacaciones/ausencia | Excepción fechada y fin automático; vuelve a la rutina después; pendientes se distribuyen y descanso sigue disponible. |
| Simulacro intermedio celebrado | Se conserva score/estado/materia; desaparece de próximos hitos; continuidad de plan general sin filtro de “vistos”. |
| Usuario sin historial | Primer tema no visto inicia comprensión con material; nada se agenda como error/repaso. |
| Tema no visto | Actividad `new` con estado pendiente; no suma a “fallado” ni a retención. |
| Preguntas o fuentes ausentes | Modo de material externo/registro en papel o actividad bloqueada con alternativa; sin explicación inventada. |
| Error repetido/acierto con duda | Error se prioriza sin bloquear todo; acierto dudoso permanece como evidencia incierta y recibe comprobación no asistida posterior. |
| Respuesta abierta | Texto/autoevaluación con fuente/criterios declarados, no `correct` objetivo salvo rubricado. |
| Pausa/recarga/doble envío | Reanudación misma versión, no pierde ni duplica; respuesta idempotente; reloj no suma tiempo en pausa. |
| Cambio disponibilidad/excepción caducada | Revisión estable con propuesta; evento vencido se historiza, no contamina siguiente plan. |
| Exceso de repasos | Límite diario y señal de backlog; combina prioridad con nuevo material/descanso. |
| Red caída | Local-first conserva evidencia; sync retrasado/reconciliado; error recuperable, account scope intacto. |
| Prueba en papel | Registro opcional agregado por tema/apartado; correct/wrong/blank solo si hay plantilla fiable; autoevaluación claramente separada. |
| Penalización incompleta | No mostrar nota neta definitiva; mostrar bruto con etiquetas y parámetros faltantes. |
| Aciertos repetidos | No confundir familiaridad/práctica inmediata con recuerdo a días; estadística reporta único/diferido y asistencia. |
| Error/plantilla de pregunta | Marcar disputa, separar validación, limitar el ítem o anularlo tras revisión; mantener historial sin recategorizar respuestas silenciosamente. |

## 8. Verificación ejecutada

Comandos ejecutados en `main` después de inspección; no se añadieron tests.

| Comando | Resultado | Qué prueba / qué no prueba |
|---|---|---|
| `git status -sb`; `git log -6 --oneline` | `main...origin/main`, HEAD `2298c5f`; limpio al inicio. | Estado local, no estado de Firebase. |
| `npm run check` | Correcto: arquitectura sin deuda nueva (2 excepciones), lint, ignore-growth, typecheck; Vitest **166 archivos pasaron, 1 omitido; 804 pasaron, 21 omitidas**. En ejecución hubo `window.scrollTo` no implementado por jsdom en un test de tarjetas, pero suite terminó verde. | Calidad estática y comportamiento unitario; no prueba la integración de cuenta remota ni todo el flujo educativo. |
| `npm run build` | Correcto. Warning de anotaciones `@__PURE__` en `zod` y bundle `start-app` >500 kB. | Compilación; no valida el currículo, la UI personal ni Firestore. |
| `npm run test:e2e` | **228 casos: 222 pasaron, 4 fallaron, 2 omitidos**; Chromium/WebKit, datos locales/Firebase simulado. La planificación de UI (inicio de tema, autoinforme y repaso siguiente día, agenda confirmada/reprogramada, viewport móvil) pasa. Auth Emulator omitido. | Dos pruebas offline fallan en ambos motores. Chromium muestra petición fallida a `http://127.0.0.1:4187/startup-theme.js` y `ERR_FAILED`; WebKit informa `Response served by service worker is an error`/`Cannot load .`. `index.html:12` referencia el script; `public/sw.js:3-4` no lo incluye en `SHELL`. Esto es consistente con un recurso no cacheado en primer arranque/recarga offline. El service worker no se modificó durante la auditoría. |

No se ejecutó el emulador de Firestore, no se autenticó en el Auth Emulator (caso omitido por la configuración E2E), ni hubo despliegue o conexión real. Las reglas descritas fueron leídas de `firestore.rules`, y las suites del repositorio incluyen `tests/firestore-rules.test.js`; estas observaciones no confirman el ruleset desplegado.

## 9. Bloqueos/decisiones abiertos y primera tarea implementable

1. **Convocatoria objetivo:** confirmar si 2027 corresponde a AGE ingreso libre u otro proceso y versionar programa oficial cuando se publique. La convocatoria de 2025 sirve de cruce provisional, no de autorización para considerarla la definitiva.
2. **Materiales autorizados:** se necesitan documentos/índices de esquemas, apartados y orden de academia, con fuente/fecha/licencia; hoy no están en el checkout. Si no están disponibles, iniciar con registros de material externo sin inventar contenido.
3. **Hito 5/11/2026:** registrar como simulacro intermedio personal de academia; detalles de corrección/penalización desconocidos. El código actual tiene -1/3 y por eso no debe presentarse como puntuación comparable sin confirmar política.
4. **Disponibilidad temporal:** configuración y experiencia no capturan 2–5/11 ni bloques horarios/pausas. Esta auditoría no cambia la agenda ni crea eventos personales.
5. **Continuidad local/remota:** el checkpoint local se puede inspeccionar y probar; Firestore real no fue leído. Aprobación/alcance de reglas desplegadas permanece no verificado.
6. **E2E offline (hallazgo inicial):** dos comprobaciones offline fallaban con referencia a `startup-theme.js` y `ERR_FAILED`; el fichero existía en `public/`, pero no formaba parte del `SHELL` estático generado. La reproducción posterior confirmó que Vite sustituye el `SHELL` de `public/sw.js` durante el build; por eso era necesario corregir también la lista en `vite.config.mjs`. Resolución verificada más abajo.

**Tarea P0 inicial:** “incluir `startup-theme.js` en el shell offline y verificar instalación/recarga sin red en Chromium y WebKit”. Se ejecutó y cerró localmente el 2026-11-02; no hubo despliegue ni escrituras de producción.

## Seguimiento de implementación P0 (2026-11-02)

- **Causa confirmada:** `vite.config.mjs:28-30` reemplaza la constante `SHELL` al generar `dist/sw.js`; editar solo `public/sw.js` no basta. La lista generada no incluía el script que carga `index.html:12`.
- **Cambio:** `public/sw.js:2-3` añade `startup-theme.js` al shell fuente y versiona la caché de shell como `tai-v79`; `vite.config.mjs:28-30` lo incluye también en el shell generado. Se conserva el nombre de caché de datos `tai-data`. En `tests/e2e/routes.spec.ts:84-92`, el E2E de shell exige que el archivo exista en `tai-v79` antes de simular la recarga offline.
- **Pruebas:** `npm run check` pasó: arquitectura sin deuda nueva (2 excepciones ya pendientes), lint, typecheck y 804 pruebas pasadas/21 omitidas. `npm run test:e2e` pasó: 226 pasadas/2 omitidas en Chromium/WebKit; las dos pruebas offline afectadas pasan en ambos motores. La suite produce advertencias previas de Zod/Rollup y `window.scrollTo` no implementado por jsdom; no provocaron fallo.
- **Límites:** validado con navegador automatizado local y build generado; sin cuenta ni lectura/escritura Firebase, sin prueba en dispositivo físico y sin despliegue. La prueba Auth Emulator permanece omitida.
- **Siguiente tarea implementable en la fecha de auditoría:** Fase 1A del backlog — ciclo de sesión versionado, transición de actividades y enlace idempotente de intentos/corrección al checkpoint; consultar backlog y preservar contratos/DTO históricos. Esta recomendación quedó satisfecha por trabajo local posterior descrito en el handoff canónico; se conserva aquí como registro histórico.

## Aclaración sobre la fecha objetivo de la aplicación (2026-11-02)

El estudiante confirma que la aplicación tiene puesta una fecha en junio. Por tanto, la agenda debe tomar la fecha configurada en la cuenta como objetivo vigente y no recurrir al fallback de 30/6/2027. La fecha exacta debe obtenerse de la preferencia `exam` cuando haya acceso autorizado a esa cuenta; esta auditoría no la leyó ni cambió. La UI de Ajustes ya aclara que el campo es una fecha objetivo y que no confirma convocatoria oficial (`src/features/settings/SettingsPage.tsx:129`). Para determinar la fecha oficial aplicable hay que contrastar una convocatoria oficial identificada; no debe derivarse del mes seleccionado en la aplicación.

Después de la auditoría se completaron localmente las rebanadas 1A, 1B y 1C, la recuperación visible de fallos de guardado y el reintento pedagógico como nuevo intento enlazado al original, visible desde el resultado de una práctica finalizada y sin efecto en estadísticas/repaso. La verificación final más reciente: `npm run check` pasó (818/21 omitidas), la suite E2E completa pasó (230/2 omitidas), el build terminó con avisos de anotaciones Zod/Rollup y chunks grandes, y `git diff --check` pasó. `npm run test:firestore-rules` no arrancó porque no hay Java en este entorno. No se validó Firebase ni se desplegó; consultar `src/features/planning/README.md` para archivos, pruebas y límites actuales. No se debe repetir la recomendación histórica de Fase 1A como si siguiera pendiente. Esta auditoría y sus actualizaciones continúan sin añadirse al commit.

## Tratamiento posterior del reintento en historial y exportación

El seguimiento posterior encontró que las métricas de evolución semanal y estrategia leían el archivo completo de intentos y habrían contado un `immediate-retry` como respuesta ordinaria. Se ajustaron localmente para excluir esos intentos de aciertos/errores y recomendaciones, reportar el número excluido, conservar su tiempo activo real y marcar en la exportación JSON el tipo y una referencia anonimizada al intento original cuando ambos están en la misma parte. El Markdown exportado describe esa exclusión y aclara que el evento no mide recuerdo diferido. Verificación: `npm run check` 818/21 omitidas, suite E2E completa 230/2 omitidas, build y `git diff --check` correctos. La validación de reglas Firestore sigue sin ejecutarse por falta de Java; no hubo lectura/escritura de backend ni despliegue.

## Continuación posterior: catálogo ampliable en la pantalla de temas (2026-11-02)

Se corrigió una brecha de código frente al caso de aceptación de incorporar temas futuros: “Temas vistos” representaba solo los grupos T1–T4 mediante una lista cerrada, aunque el catálogo es la fuente dinámica de los temas. `groupTopics` ahora agrupa cualquier ID por su segmento antes del punto, conserva el orden de entrada y muestra nombres conocidos para grupos existentes o una etiqueta genérica para los nuevos. La prueba confirma la visibilidad/selección del T5.02 y el orden de T5.01/T5.02 sin lógica por código concreto. Este orden es el orden entregado por el catálogo solo para presentación; no se declara orden real de academia y el planificador no lo consume como tal.

Verificación de esa primera actualización: `npm run check` pasó (820/21 omitidas; un archivo de pruebas omitido) y `npm run build` pasó. Después se localizaron más validadores de tema con límite T1–T4, documentados y corregidos en la continuación siguiente.

## Continuación posterior: IDs de tema para bloques futuros (2026-11-02)

La limitación no estaba solo en la pantalla: varios puntos de ejecución y persistencia rechazaban IDs de tema distintos de T1–T4 o con bloques de más de un dígito. Se añadió `src/core/domain/topic-id.ts` como validador estructural común (`T` + número positivo de bloque + punto + dos dígitos de tema), y se actualizaron filtros de ruta, checkpoints, preferencias, calendario de repasos, autoevaluaciones en papel, vistas de test/tarjetas/fallos, carga del catálogo, lectura de caché offline y los patrones de archivos de pruebas. El enlace de práctica intersecta el parámetro de ruta con los temas ya vistos, así que un ID sintácticamente válido no se convierte en contenido ni en tema estudiado. El tope de preferencias por tema subió de 36 a 500 como límite defensivo.

La regla Firestore local admite el formato general en `topicId` y un máximo de 500 elementos en `topicIds`; se añadió un caso de prueba para `T12.01`. Al ejecutar `npm run test:firestore-rules`, Firebase Emulator Suite no arrancó porque `java -version` falla al no existir Java. El cambio de regla no está validado por emulador ni producción y no se desplegó.

**Verificación local:** `npm run check` (823 pasadas, 22 omitidas; un archivo omitido), `npm run build` y `git diff --check` pasaron. Avisos: jsdom `window.scrollTo`, comentarios Zod/Rollup y chunks dinámicos Firebase 539.32 kB / C++ Shiki 796.96 kB. No se ejecutó E2E, no se leyó ni escribió Firebase y no hubo despliegue.

El trabajo hace que los flujos locales acepten nuevos IDs con el formato de catálogo, no que añada el currículo oficial o los datos de academia. Una consulta actualizada en BOE e INAP no identificó una convocatoria AGE TAI 2027; BOE-A-2025-26262 sigue siendo una referencia provisional. Faltan la convocatoria objetivo confirmada y materiales/orden de academia con fecha y procedencia. El formato continúa siendo estructural; el catálogo es la autoridad para contenido y el conjunto `seen` para habilitar práctica/revisión.

## Continuación posterior: secuencia de academia configurable (2026-11-02)

Se confirmó que el planificador solo recibía el `introductionTopicId` semanal que se elegía manualmente en Ajustes. Para dejar de depender de una selección semanal y no adivinar el orden, se añadió `training.academyTopicOrderIds`, una preferencia opcional explícita. Ajustes permite añadir temas del catálogo al final, moverlos arriba/abajo y quitarlos. No importa automáticamente la lista/códigos en orden, y los IDs seleccionados que desaparecen temporalmente del catálogo se conservan. Sin secuencia configurada, las preferencias antiguas mantienen su comportamiento. Con secuencia configurada, el tema nuevo es el primer ID de esa secuencia que aún no se marcó como visto y existe en el catálogo. Un tema pendiente se trata como nuevo; no como repaso fallido. El tope es 300 IDs, respetando el límite existente de arrays de configuración.

Esta fase habilita el orden como dato editable, pero aún no registra procedencia/fecha/fuente ni contrasta el orden completo con una academia oficial; esos datos deben confirmarse antes de llamar a la secuencia “oficial”. Tampoco agrega material de estudio ni sustituye el programa de convocatoria. La nueva preferencia es local/configuración de usuario y se guarda mediante el contrato actual de preferencias; no se leyó ni escribió configuración remota.

**Verificación:** `npm run check` pasa (829 pruebas aprobadas/22 omitidas; arquitectura, lint y TypeScript correctos); `npm run build` pasa con los avisos conocidos de Zod/Rollup y chunks dinámicos de Firebase (539.32 kB) y C++ Shiki (796.96 kB); `git diff --check` pasa. La suite E2E completa encontró dos fallos del caso de reflujo con texto ampliado, ambos en Ajustes y en ambos motores. La inspección identificó el nuevo selector dentro de un flex como causa: su tamaño intrínseco expandía el fieldset. Se reemplazó por una cuadrícula con columnas reducibles; la repetición aislada del mismo caso pasó en Chromium y WebKit (2/2). No se repitió toda E2E tras la corrección. El árbol ya contenía modificaciones locales de otras fases y el informe de auditoría sin seguimiento; se conservaron sin staging. No commit, push, despliegue ni lecturas/escrituras de producción.

**Siguiente paso recomendado:** incorporar una fuente/versionado a esta lista y conectarla al programa completo solo cuando se identifiquen la convocatoria y la academia aplicables. En paralelo, el planificador global/semanal todavía necesita una fase propia que consuma cobertura por tema/apartado, objetivo editable y disponibilidad/excepciones sin convertir `seen` en evidencia de aprendizaje.

## Integración posterior de horizonte y semana (2026-11-02)

Se implementó una primera vista `Horizonte y semana` en Planificación, alimentada por `settings.exam`, preferencias de entrenamiento ya cargadas, IDs del catálogo y `services.seenTopics()`. El dominio cuenta la secuencia explícita vigente, marcas de cobertura declarada, temas presentes en catálogo pero fuera de la secuencia e IDs secuenciados que no aparecen en el catálogo. Suma minutos/días semanales con foco de contenido nuevo y calcula cuántos de esos espacios cabrían hasta el objetivo (sin contar el día del objetivo). Es un límite optimista de capacidad, no horas por tema ni dominio.

La fecha exacta de la cuenta no se consultó: se usa la preferencia que entrega el runtime local. La UI ya no usa el fallback de 30/6/2027; si falta fecha válida, invita a configurarla. Una secuencia agotada no obliga a escoger tema ni selecciona por ID/catálogo. La vista de semana refleja patrón habitual editable, no eventos concretos ni una agenda estable.

**Verificación local:** `npm test -- tests/domain/study-planning-horizon.test.js tests/planning-page.test.js` pasó (17); `npm run check` pasó (836 pasadas/22 omitidas; arquitectura, lint y TypeScript); `npm run build` pasó con advertencias de anotación Zod/Rollup y chunks >500 kB; E2E focalizado de entrada a Planificación y reflujo responsive pasó 4/4 en Chromium y WebKit; `git diff --check` pasó. No verifica preferencias remotas ni Firebase. El informe continúa local y sin seguimiento.

**Brechas abiertas:** excepciones/vigencia de calendario (vacaciones 2–5/11/2026, ya históricas en la fecha actual; ausencias, festivos, clases y descansos), simulacros intermedios con política de puntuación propia, plan semanal fechado y replanificación, apartados/versiones del currículo, cobertura parcial y materiales vinculados. Una marca de tema visto no equivale a cubrir sus apartados.

## Integración posterior de eventos de calendario (2026-11-02)

Se añadió `TrainingCalendarEvent` opcional dentro de `TrainingPreferences` y se permite únicamente mediante el esquema compartido `cleanCfg`. Los eventos tienen ID, tipo, título, rango inclusivo, procedencia opcional, timestamps y, para `study-window`, minutos enfocados por día, hora inicial/final y foco opcional. Tipos: `unavailable` (ausencia/vacaciones), `study-window` (presupuesto especial), `class` e `milestone` (informativos). La normalización valida fechas del calendario, formatos, límites y duplicados. Se limita la lista a 200 eventos.

`SettingsPage` añade/borra eventos y etiqueta cada uno como pasado, en curso o próximo; borrar requiere una acción explícita. El texto de procedencia es una nota personal y no prueba que el evento/hito sea oficial. `resolveTrainingDay` aplica `unavailable` con prioridad sobre ventanas; entre ventanas solapadas gana la última actualizada. Clase/hito no cambian el presupuesto. El plan diario, el calendario de repasos, la vista semanal y la capacidad global consultan la disponibilidad de la fecha. Tras una fecha histórica, la regla deja de aplicarse automáticamente; el evento se conserva visible como historial y no cambia las preferencias semanales.

**Limitación importante:** una franja 08:00–15:00 es solo ventana disponible; los minutos enfocados se introducen por separado y excluyen pausas. Esta primera versión no convierte minutos >120 en varios bloques ni inserta pausas cronometradas; la sesión diaria existente requiere pausa/reanudación manual. Los hitos aún no se conectan al simulacro ni guardan una `ScoringPolicy`. No se leyeron ni escribieron preferencias de cuenta remota/Firebase.

**Verificación local:** `npm run check`: arquitectura sin deuda nueva (2 excepciones), lint, ignore-growth, typecheck y Vitest 170 archivos pasados/1 omitido; 844 pruebas pasadas/22 omitidas. `npm run build` pasa con advertencias conocidas de anotación Zod/Rollup y chunks >500 kB. E2E de guardado, semana/plan por fecha, recarga y regreso al plan ordinario tras el 5/11 pasó en Chromium y WebKit (2/2). Las pruebas focalizadas de dominio, preferencias, capacidad del calendario y Ajustes pasaron (70). `git diff --check` pasa. Sin sync remoto verificado, push, tag, release o deploy.

## Fuentes

- Resolución de convocatoria oficial: [BOE-A-2025-26262, Anexo V](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262), especialmente puntos 2–3 y temas (líneas oficiales alrededor de 1044–1145).
- Fecha del ejercicio oficial AGE TAI: [BOE-A-2026-6249, apartado Cuarto y Anexo XI](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-6249), fecha 23/5/2026.
- Referencia de aprendizaje: Dunlosky et al. (2013), [Improving Students' Learning With Effective Learning Techniques](https://doi.org/10.1177/1529100612453266), revisión identificable en [PubMed](https://pubmed.ncbi.nlm.nih.gov/26173288/). Apoya, con límites por técnica/contexto, práctica de recuperación y distribuida; releer de forma aislada no es estrategia suficiente. La decisión de forzar un ciclo en el producto sigue siendo hipótesis a validar.
- Límite contra estilos de aprendizaje: Pashler et al. (2008), [Learning Styles: Concepts and Evidence](https://doi.org/10.1111/j.1539-6053.2009.01038.x). La revisión describe la falta de evidencia del diseño que demostraría beneficios de “emparejar” instrucción a estilo; no se infiere un estilo del estudiante.

## Instrucción posterior sobre la fuente curricular (2026-11-02)

El estudiante especificó que `/Volumes/SSD/Google Drive/TEMARIO_OPOSICION/01_Temario` es la única fuente de verdad para currículo y materiales. El contraste oficial citado en el corte inicial anterior queda como antecedente histórico y no debe usarse para rellenar, corregir ni priorizar apartados en esta implementación. En esta fase no se consultó la web. El inventario e índice derivados únicamente de la carpeta se documentan en la sección «Índice de materiales del temario en Drive» del README canónico; el archivo de auditoría continúa local y fuera de commits.

## Seguimiento de implementación posterior (2026-11-02)

En la rama local `feat/study-plan-through-exam` se añadió configuración de bloques orientativos (25–45 min), pausa cronometrada persistida en el checkpoint diario sin duplicar ni cambiar la actividad y visualización semanal por fechas de repasos programados, eventos, sesiones activas y sesiones completadas. El checkpoint pausa el tiempo de foco, y permite terminar antes o después de la pausa y retomar la misma actividad. La agenda fechada todavía no guarda una propuesta completa de sesiones futuras ni redistribuye automáticamente sesiones perdidas; el editor mensual permite reprogramar cada repaso explícito con confirmación. Verificación local: `npm run check` (846 pasadas/22 omitidas, 1 archivo omitido), build, `git diff --check`; E2E de pausa/reanudación 2/2 Chromium/WebKit, excepciones 2/2, planificación/reprogramación fechada 4/4 e inicio de sesión de estudio 2/2. Persisten avisos conocidos jsdom `window.scrollTo`, Zod/Rollup y chunks >500 kB. No se leyó Firebase ni se hizo prueba en dispositivo físico. Esta actualización documental sigue sin seguimiento y fuera de commits, como solicitado.

## Inventario y disponibilidad para propuestas semanales (2026-11-02)

Recuento estático local: 36 temas; 15.661 filas de preguntas no sustituidas tanto en metadatos como en los JSON temáticos; 1.410 tarjetas curadas utilizables. Todos los 36 temas tienen preguntas y tarjetas locales. Las cinco explicaciones de `public/explanations/index.json` corresponden a T3.03 y son `draft`; no hay `reviewed`. No existe manifiesto de apartados/esquemas/resúmenes enlazados. Esos totales prueban existencia local, no coincidencia del banco en Firestore ni cobertura o vigencia oficial.

En el commit funcional pendiente, `HomeServices.loadOverview` entrega los temas enumerados por los metadatos de preguntas y el índice de tarjetas. La propuesta semanal omite prácticas cuando el manifiesto de la modalidad no las confirma y expone los temas/modalidades omitidos; si falla la carga conserva `null` como “no verificable”. No se precargan bancos completos, no se interpretan borradores como fuentes y no se declara que “contenido nuevo” tenga resumen: esa actividad sigue llevando al índice del tema y requiere material externo.

Validación local tras este cambio: `npm run check` 867 pasadas/24 omitidas (171 archivos pasados/1 omitido); `npm run build` correcto con advertencias conocidas Zod/Rollup y chunks `firebase-vendor` 539 kB, C++ 797 kB; pruebas de dominio/UI 28/28; E2E de Planificación 4/4 Chromium/WebKit. El E2E intentado en sandbox recibió `EPERM` al abrir `127.0.0.1:4187`; rerun autorizado fuera del sandbox pasó. `git diff --check` limpio. No se consultó Firestore ni se hizo deploy. Esta auditoría continúa untracked y excluida del commit.

## Integración de brecha global en propuestas semanales (2026-11-02)

La proyección cuenta espacios habituales para contenido nuevo más los días futuros con entrada confirmada `planned` de contenido nuevo fuera del foco habitual, si el día conserva minutos, el tema sigue pendiente y no hay otro espacio base ese día. No suma las tareas como temas completados; la secuencia se considera cubierta solo al recibir la marca declarada correspondiente. Las tareas completadas/omitidas y las fechas sin disponibilidad no aumentan capacidad futura.

Cuando la brecha optimista restante es positiva, la propuesta semanal puede añadir contenido nuevo en días de consolidación futuros no reservados, hasta intentar cubrirla o acabar la semana. La propuesta muestra brecha antes/después e IDs incorporados. Es una expansión local a la semana seleccionada; no cambia el patrón semanal recurrente ni reescribe la agenda hasta la confirmación explícita. Una propuesta nueva requiere la revisión base vigente.

Verificación actual: segundo `npm run check` pasó (870 pruebas, 24 omitidas; 171 archivos pasados/1 omitido); `npm run build` pasó con warnings conocidos Zod/Rollup y chunks `firebase-vendor` 539 kB/C++ 797 kB; E2E Planificación 4/4 (Chromium/WebKit); casos focalizados de horizonte/agenda/Planning 37/37; `git diff --check` limpio. La primera suite completa tuvo una carrera aislada en `design-home-stats.test.js`; ejecutado solo pasó 7/7 y en el segundo check pasó la suite completa. El E2E pasó dentro del sandbox. Sin acceso Firebase real ni despliegue. La explicación en interfaz de que el estudio de contenido nuevo depende de material externo ya existía y está cubierta por `tests/planning-page.test.js`; no se duplicó.

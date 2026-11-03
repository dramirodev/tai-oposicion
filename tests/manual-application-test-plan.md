# Plan de pruebas manuales de la aplicación TAI

**Propósito:** recorrer la aplicación real desde Chrome como usuario, en varias sesiones, y comprobar sus pantallas y flujos de extremo a extremo. Este plan distingue la inspección visual de la verificación de guardado, sincronización o comportamiento fuera de línea.

**Alcance de código:** rutas definidas en `src/app/router/route-runtime.tsx` y navegación de `src/app/layouts/WorkspaceNavigation.tsx`. Las pruebas automatizadas de `tests/e2e/` son referencias, no sustituyen el recorrido autenticado. La ejecución manual cubre únicamente el navegador y la cuenta efectivamente disponibles.

## Reglas de ejecución y protección de la cuenta

1. El usuario inicia sesión en Chrome. No se solicitan, leen, copian ni registran contraseñas, tokens, correo ni otros datos personales.
2. La primera sesión es **solo lectura**: navegar, observar estados, comprobar carga, contenido y errores visibles. No empezar sesiones, responder preguntas, cambiar preferencias, seleccionar material, guardar, enviar formularios ni cerrar sesión.
3. Antes del primer paso que pueda guardar datos, mostraré qué acción voy a probar, qué registros puede crear o cambiar y si puede sincronizarse. Continuaré solo cuando el usuario haya elegido usar una cuenta de prueba/ invitado o haya autorizado esos cambios en la cuenta abierta.
4. No borraré historial, no restauraré/importaré copias, no publicaré mapas editoriales, no enviaré avisos reales, no concederé/revocaré accesos ni cerraré la sesión autenticada. Las acciones de propietario se observarán solo si la cuenta actual tiene ese permiso y no se confirmarán escrituras administrativas.
5. Interactuaré mediante la interfaz de Chrome. No editaré progreso con DevTools, no escribiré directamente en Firebase ni presentaré una prueba local o estática como verificación remota.
6. Si aparece una cuenta inesperada, una sesión real activa, un error de sincronización o una acción destructiva, me detendré y lo registraré antes de continuar.
7. Cada resultado se etiqueta: **Correcto**, **Fallo**, **Bloqueado**, **No aplica** o **No verificado**. “Correcto en Chrome” no acredita otros dispositivos, otros motores ni Firebase si la escritura remota no puede observarse.

## Preparación antes de la sesión 1

- Abrir Chrome, iniciar sesión en la cuenta que se vaya a probar y dejar la aplicación en Inicio, sin pulsar otros controles.
- Enviarme un mensaje diciendo **«lista para la sesión 1»**. No hace falta compartir credenciales ni capturas que muestren datos personales.
- Registrar solo lo necesario: fecha/hora, pantalla, dimensiones aproximadas, estado visible de acceso (invitado, acceso completo, limitado o propietario) y versión si la UI la muestra. No copiar identificadores personales.
- Confirmar si la aplicación abierta es producción, preproducción o local cuando esa procedencia sea visible. Si no se puede determinar, marcar entorno como **no verificado**; no inferirlo por la apariencia.

## Sesiones

La duración es orientativa; se puede detener cada sesión y reanudar desde este documento. Las sesiones 2–6 contienen acciones que pueden persistir y quedan sujetas a la confirmación del punto anterior.

### Sesión 1 — Estado inicial, permisos y navegación (solo lectura; 20–30 min)

- Inicio: carga completa, fecha objetivo visible, progreso y acciones propuestas; comprobar que no aparezcan errores ni loaders permanentes.
- Abrir, sin iniciar actividad, Planificación, Temario, Test, Simulacros, Parte 2, Estadísticas, Tarjetas, Falladas, Errores, Lectura atenta, Detective de trampas, Relámpago, Ajustes, Accesos y Ayuda.
- Comprobar el estado de autenticación/acceso que muestra la interfaz. El usuario ya habrá iniciado sesión; no cerrar sesión ni cambiar de cuenta durante la inspección.
- Comprobar rutas con hash, título principal, retorno mediante navegación, indicador de sección activa, menú móvil, enlace “Saltar al contenido”, foco visible y ausencia de desbordamiento horizontal.
- Anotar qué pantallas están ocultas o redirigidas por el permiso actual. No intentar eludir controles ni cambiar de cuenta.
- Revisar estados vacíos, avisos de red y errores visibles sin activar acciones que escriban.

**Salida:** inventario real de pantallas accesibles y bloqueadas para esta cuenta; lista de anomalías visuales o de navegación. Nada guardado intencionadamente.

### Sesión 2 — Planificación, calendario y Temario (30–45 min)

**Con autorización de escritura:**

- Revisar horizonte, semana, vista mensual, disponibilidad, descansos, eventos pasados/futuros, propuesta de semana y déficit de capacidad.
- Iniciar una sesión diaria; comprobar actividad actual, tiempo y motivo. Pausar, recargar y retomar la misma actividad sin duplicarla. Cerrar un paso permitido y verificar historial/agenda.
- Desde un tema, consultar material e índice, seleccionar el material principal si procede, registrar cobertura parcial y comprobar el estado después de recargar. Verificar que abrir/leer un índice no se convierta en cobertura ni en aprendizaje demostrado.
- Recorrer un tema nuevo y uno ya visto: comprobar que el nuevo comienza con comprensión/material y el conocido puede pedir recuperación antes de consultar.
- Comprobar revisión programada: propuesta, confirmación, visibilidad en semana/agenda y apertura del material asociado. No crear múltiples eventos para probar idempotencia en datos personales.

**Salida:** continuidad de sesión y agenda observada; materiales, estados y persistencia local/remota separados. Las autoevaluaciones se registran como subjetivas, no como resultado objetivo.

### Sesión 3 — Práctica, corrección y continuidad (30–45 min)

**Con autorización de crear intentos de prueba:**

- Abrir una práctica corta por tema y una sesión rápida. Verificar selección de temas/origen y cantidad antes de empezar.
- En preguntas de prueba, cubrir respuesta correcta, incorrecta, blanco/consulta de solución, confianza o duda cuando esté disponible, opción descartada/subrayado y explicación/fuente.
- Comprobar qué se muestra antes y después de responder; avanzar, volver a pendientes si procede, pausar/recargar y reanudar; finalizar y comprobar el enlace entre intento, sesión y resultado.
- Intentar doble envío solo con una pregunta de prueba; verificar que no duplique el intento. Revisar el tratamiento de respuesta dudosa y reintento, sin declarar que una explicación generada sea verificada.
- Confirmar que el modo de simulacro no revela solución/corrección antes del final.

**Salida:** una trazabilidad de pregunta→respuesta→corrección→resultado, con el impacto en historial claramente señalado.

### Sesión 4 — Repaso, entrenadores y estadísticas (30–45 min)

**Con autorización de actualizar progreso:**

- Tarjetas: intentar recordar, revelar, valorar, avanzar y retomar. Comprobar separación entre valoración, acierto de pregunta y repetición futura.
- Falladas: buscar/filtrar, revisar explicación/referencia, comprobar cola y racha con un intento de prueba.
- Entrenadores: Lectura atenta, Detective de trampas y Relámpago; comprobar entrada, ayuda, respuesta, feedback y salida.
- Estadísticas: estado vacío/con datos disponibles, gráficos, filtros, temas, sesiones y modo simulacro; comparar antes/después del intento creado y comprobar que no se infle retención por aciertos inmediatos.
- Resultados por apartado: confirmar el estado vacío actual si el manifiesto editorial no tiene vínculos aprobados. No publicar candidatos ni inferir un apartado.

**Salida:** resultados objetivos y autoevaluaciones permanecen separados; estadísticas accesibles sin afirmaciones de dominio no respaldadas.

### Resultado manual de Sesión 4 — repaso, entrenadores y estadísticas (2026-11-03)

Recorrido realizado en Chrome autenticado, escritorio, sobre `tai-oposicion.firebaseapp.com` (entorno no confirmado independientemente). Se usaron respuestas sintéticas para comprobar interacción; alteraron el historial visible y se dejó una tarjeta de prueba. No se reanudó ni modificó la sesión diaria pausada de Sesión 2.

- **Tarjetas/Falladas:** al inicio Tarjetas indicaba cero y estado vacío, mientras Inicio mostraba 26 pendientes. Busqué en Falladas una pregunta de T2.04, abrí su extracto de temario (la cita no tiene enlace PDF verificado) e inicié una práctica de un ítem. Un acierto actualizó la racha visible de 0/3 a 1/3; un segundo intento erróneo la dejó en 0/3 y ofreció «Hacer tarjeta». La tarjeta quedó creada. Tarjetas pasó a 1 en repaso, pero 0 vencidas/nuevas; el inicio siguió indicando 26 pendientes. Abrir, revelar y calificar «Dudaba» funcionó; el resumen contó 1 dudaba, pero la frase final decía que se marcó «lo sabía». Después Tarjetas mostró 0 vencidas/nuevas y 1 en repaso, sin poder iniciar otra sesión. La tarjeta no se eliminó. Al recargar durante actividades, una Falladas incompleta ofreció Continuar y restauró su respuesta; al volver a Tarjetas, el repaso estaba revelado y conservaba progreso 0. Es evidencia de continuidad visible de esta ruta, no de sincronización remota.
- **Lectura atenta:** entró directamente en la pregunta 1/8, sin introducción. Completé sus tres pasos (identificación CORRECTA, palabra clave y respuesta); dio feedback y fragmento del temario. Una captura accesible transitoria mostró «Lectura mínima: 1793703941 s» y opciones desactivadas; en una lectura posterior el texto ya no aparecía y las opciones estaban activas. Avancé a 2/8 y salí con confirmación. Inicio pasó de 1471 a 1472 preguntas vistas; no identifiqué un registro explícito de sesión completada.
- **Detective de trampas:** en un ítem de T3.06 marqué una falsa alarma; explicó las dos trampas válidas y la falsa alarma. En un ítem de T3.02 identifiqué Intersección vs unión y mostró «¡Detectadas todas!» con explicación. Salí tras dos preguntas; no observé registro explícito de sesión en Progreso.
- **Relámpago:** se inició directamente en una pregunta de T3.05. Respondí dos ítems (T3.05 y T3.04), ambos correctos, con feedback y nota; salí a Inicio sin resumen visible.
- **Progreso/estadísticas:** el total pasó de 2085 a 2090 respuestas registradas y se mantuvo en 58 %. Vistas Temas, Simulacros y Evolución; filtros y gráfico de tiempo funcionaron. La gráfica de retención declara que es estimación FSRS-6 para 31 tarjetas con valoración, no resultado observado ni todo el temario. El informe de estrategia se declara descriptivo y no causal, pero a la vez muestra «muestra insuficiente» con 296/20 respuestas y 18/3 sesiones (también 176/11 y 120/17 en subgrupos), cuya regla de elegibilidad no queda explicada. El tiempo activo siguió en 2 h 28 min; «Repasar hoy» mostró cifras diferentes según Inicio/Progreso. No basta esta pasada para atribuir errores de cálculo: quedan como candidatas por aclarar semántica y denominadores.

Las explicaciones son heterogéneas: algunos entrenadores aportan extractos y razonamiento; las referencias examinadas mantienen el aviso de cita sin enlace PDF verificado. No se comprobó guardado Firestore, red, móvil ni otro navegador. La sesión 4 queda completada para los recorridos observados; el inventario completo del plan manual sigue pendiente.

### Sesión 5 — Simulacros Parte 1, Parte 2 y pruebas en papel (30–60 min; examen completo opcional)

**Con autorización expresa antes de crear un resultado persistente:**

- Recorrer catálogo, modalidades, selección por examen/tema, filtros, configuración de preguntas, duración, opciones y política de puntuación visible.
- Hacer un recorrido corto si la UI lo permite: iniciar, contestar, dejar blanco, navegar, pausar/retomar y finalizar; comprobar corrección solo al cerrar, resultado, análisis y revisión.
- Abrir Parte 2 y comprobar selección/resultado cuando existan supuestos disponibles.
- Registrar un tramo de test en papel: duración y respuestas según el flujo disponible; confirmar que se puede corregir con clave conocida o dejar parámetros de penalización incompletos sin mostrar nota neta definitiva.
- Un simulacro completo de 100 preguntas/90 minutos es opcional por su duración y por dejar un resultado permanente en historial; no se inicia automáticamente.

**Salida:** modalidad, reglas de puntuación, resultados y límites visibles; el historial de prueba queda identificado como tal si se autoriza.

### Resultado manual de Sesión 5 — simulacro y prueba en papel (2026-11-03)

Recorrido de Chrome autenticado en escritorio, `tai-oposicion.firebaseapp.com` (entorno no confirmado). Se creó un intento digital sintético y persistente para comprobar el flujo extremo a extremo; no se ejecutó un examen completo ni se probó escritura remota.

- **Configuración y catálogo:** «Completo» ofrece 40/80 preguntas, 45/60/90/120 min, mis 19 temas vistos o todo el temario, origen Generadas/Oficiales/Academia y una casilla para añadir Parte 2 («elegir 1 de 2 supuestos prácticos (20 preguntas)»). El texto visible declara que cada fallo resta 1/3, el blanco no resta y no hay corrección hasta el final. «Por examen» enumera pruebas oficiales (p. ej. Ingreso libre 2019, 80 preguntas) y de academia (p. ej. Simulacro 1, 96); «Por tema» enumera tests de academia desde T1.01 hasta T4.10. La vista muestra preguntas y, cuando existe, un resultado previo. No inicié los intentos de esos catálogos. La selección de supuesto concreto y el resultado de Parte 2 quedaron sin comprobar.
- **Intento breve:** cambié temporalmente a 40 preguntas/45 min, solo conocimientos, y mantuve ambos orígenes. La pregunta inicial fue generada de T2.04. Elegí B, marqué «Entre dos» y «Marcar para revisar». El simulacro no mostró respuesta correcta ni explicación durante el intento. Pausar mostró «El tiempo está detenido»; al recargar ofreció Continuar con 1/40 y 44:56, y recuperó respuesta, confianza y marca. El mapa reflejó 1 respondida/1 para revisar y permitió ir directamente a la pregunta 40/40.
- **Cierre/resultado:** Terminar pidió confirmar que quedaban 39 preguntas sin responder y guardaría la sesión como interrumpida. Resultado conservó las no contestadas como blancos: 1 fallo, 39 blancos, 0 aciertos, 0 % sobre respondidas, puntuación global −0,8/100 y fórmula `100 × (aciertos − fallos/3) / total de preguntas`. No se revisaron las 40 explicaciones individuales. El intento permanece en el historial visible.
- **Prueba en papel:** en la ruta de Simulacros y la ayuda asociada no encontré una opción para registrar respuestas/duración de un test en papel, introducir su clave y corregirlo sin transcribir las preguntas. Lo observado acredita que ese flujo no está expuesto en estas pantallas, no que no exista en otra ruta o perfil.

Al terminar restauré la configuración visible a 80 preguntas, 90 min, 19 temas vistos y Parte 2 activada. La prueba de Parte 2 y la integración de test en papel quedan incompletas/pendientes, por lo que Sesión 5 queda **parcial**, no aprobada de extremo a extremo para todas sus modalidades. La interfaz presenta una penalización configurada de −1/3; esto es evidencia del producto y no confirma que coincida con la convocatoria oficial. La configuración de referencia del estudiante (100 preguntas/90 min y penalización desconocida) no debe darse por equivalente.

### Sesión 6 — Ajustes, acceso, sincronización y operación sin conexión (30–45 min)

**Observación primero; cambios solo con autorización:**

- Ajustes: fecha objetivo, disponibilidad semanal, orden de academia, temas activos, preferencias de preguntas, tamaño de letra/tema y eventos de calendario. Guardar únicamente el cambio aprobado y restaurarlo solo si el usuario lo pide.
- Revisar las opciones de descarga/exportación (copia de progreso, sesiones, Anki o informe) sin guardar ni compartir archivos que contengan datos personales hasta acordarlo. No importar/restaurar copias, porque puede reemplazar progreso.
- Revisar la información de versión/actualización; no forzar actualización ni recarga si hay sesión activa sin pausar/guardar.
- Si se necesita validar Google Sign-In, sesión persistente, cambio de cuenta o aislamiento de perfiles, hacerlo únicamente en cuenta/perfil de prueba; la sesión personal ya iniciada no se cierra ni se cambia.
- Accesos: revisar estado de solicitud/permisos del usuario actual. No solicitar, aprobar ni revocar accesos reales en producción.
- Curación editorial `/curar-contenido`: comprobar acceso solo si el usuario ya tiene permiso de propietario; inspeccionar cola y estado vacío. No aprobar, importar, exportar ni publicar.
- Conexión: observar estado de sync y último resultado visible. Si es seguro, simular una desconexión temporal del navegador y comprobar aviso/retorno; no borrar caché, IndexedDB ni almacenamiento del sitio. No desconectar si la sesión real puede perderse.
- Comprobar que las acciones visibles sin conexión se recuperan al volver la red. Marcar Firebase como **no verificado** salvo confirmación de sincronización real en UI.

**Salida:** preferencias y permisos observados; distinción entre persistencia local y sincronización, con cualquier cambio autorizado anotado.

### Resultado manual de Sesión 6 — Ajustes, acceso y PWA (2026-11-03)

Recorrido de solo lectura en Chrome autenticado, escritorio, en `tai-oposicion.firebaseapp.com` (entorno no confirmado). No cambié preferencias, no cerré sesión, no solicité ni modifiqué accesos, no descargué, copié ni borré archivos y no desconecté la red.

- **Cuenta y sincronización mostradas:** Ajustes dice «Conectado como David», «Propietario · acceso completo», «sincronizado · 12:10:33» y «Estado: sincronizado» en Diagnóstico técnico. En la misma pantalla aparece «No se pudo guardar en la nube (permission-denied)». Lo anterior es evidencia de mensajes de UI incompatibles o referidos a estados/operaciones distintas; no identifica cuál ni demuestra lectura o escritura de Firestore. El contador visible local dice 1512 preguntas vistas, 19 temas vistos y 67 sesiones.
- **Accesos:** la página informa 0 solicitudes y 0 usuarios adicionales con acceso completo. No se ejecutaron acciones administrativas.
- **Ajustes:** versión visible 1.1.12 (2298c5f); objetivo 30/06/2027 con aclaración expresa de que no confirma convocatoria oficial; disponibilidad semanal de 120 minutos lunes–sábado y descanso domingo; lunes, martes, jueves y viernes «Contenido nuevo», miércoles y sábado «Recuperación y consolidación»; jueves para introducción semanal, sin tema asignado. Apariencia Automática, tamaño A y Lectura atenta Normal. Todo quedó sin cambios.
- **PWA/offline:** la UI informa «Descarga incompleta: faltan 2 de 41 archivos» (`cards/index.json`, `explanations/index.json`) y ofrece descargar. Observé la opción, pero no la ejecuté porque modifica almacenamiento local. Tampoco forcé actualización ni desconecté la red. Por tanto, descarga, uso offline, retorno de red y sincronización no quedan validados.
- **Copias y borrado:** observé exportar progreso, importar, exportar tarjetas/analítica, borrado de historial y borrado local, sin pulsarlos; no se generaron archivos ni se alteraron datos.

La Sesión 6 queda **parcial**: Ajustes y Accesos se recorrieron sin cambios; el estado de permisos de nube y toda sincronización remota u operación offline están pendientes de aclaración/validación. El texto `permission-denied` debe conservarse como señal observada, no como diagnóstico de reglas, entorno o backend.

### Sesión 7 — Cierre y regresión de navegación (15–25 min)

- Volver a Inicio y recorrer las rutas con los datos de prueba existentes, sin crear nuevos intentos.
- Revisar sesiones abiertas/pausadas, eventos programados, errores recuperables y consistencia básica del historial.
- Confirmar con el usuario si se conserva el progreso de prueba autorizado o si quiere retirar alguna actividad reversible desde las opciones normales de la aplicación. No borrar datos directamente.
- Completar la matriz de cobertura, listar fallos reproducibles, bloqueos por permisos/red/entorno y flujos que no se pudieron ejecutar.

### Resultado manual de Sesión 7 — cierre y regresión (2026-11-03)

Recorrido de solo lectura en Chrome autenticado, escritorio; no inicié preguntas nuevas ni cambié preferencias, filtros, permisos o datos.

- Inicio muestra 1512/15.661 preguntas vistas, 19/36 temas, 27 tarjetas pendientes, 297 preguntas para «Repasar hoy» y 520 falladas. El simulacro interrumpido de 40 preguntas aparece como la sesión más reciente en Progreso, con −0,8/100. El contador global visible pasó de 2090 a 2130 respuestas registradas y 57 % de acierto; un simulacro de 40 preguntas parece contabilizar 40 respuestas/eventos aunque 39 fueran blancos. Esta es evidencia de estadísticas visibles, no de un defecto hasta aclarar el contrato de conteo.
- Planificación conserva 0/5 y 0:28 en el paso 1/5 «Recuperación activa», marcado «en pausa», y sigue enlazando a Tarjetas. «Comenzar sesión» es el único botón visible en la tarjeta del día; Inicio no ofrece un CTA directo para continuar. No pulsé el botón para evitar alterar la sesión pausada. El historial reciente de Planificación dice que las sesiones completadas aparecerán allí; el estado incompleto continúa visible en la tarjeta actual.
- Vista mensual de noviembre mantiene 120 minutos y enfoque ordinario los días 2–5, sin evento vacacional visible. No edité calendario ni replanifiqué.
- Ajustes enlaza a Errores del banco, que muestra 1 aviso por revisar y 0 resueltos. El aviso existente es `AS08B-P1-07`, Academia, motivo «Opciones repetidas o dos correctas», sobre composición del Gobierno en la Constitución. La lista ofrece «Marcar resuelto» y «Quitar»; no pulsé ninguna, ni exporté el aviso.

La Sesión 7 queda completa para regresión de navegación/historial visible. No se borraron resultados ni tarjeta de prueba: retirar esos datos queda pendiente de decisión del usuario y no forma parte de esta sesión. Se deja la sesión diaria pausada y el simulacro interrumpido en el estado encontrado.

### Sesión 8 — Comprobación de anomalías observadas

Reproducir y clasificar estas señales observadas en Chrome el 3/11/2026. Son **pendientes de confirmación**, no bugs declarados:

1. **Contador de tarjetas:** Inicio mostró 26 tarjetas pendientes; Tarjetas mostró 0 vencen hoy, 0 nuevas, 0 en repaso, 0 dominadas y el estado vacío «Aún no tienes tarjetas». Repetir la navegación tras cargar datos y comprobar si ambos contadores miden lo mismo. No abrir ni calificar una tarjeta durante esta comprobación sin autorización.
2. **Tipo/contenido de sesión diaria:** Planificación etiquetó el día «Contenido nuevo» y anunció avanzar el tema nuevo, pero Ajustes mostró «Sin tema asignado» para el tema de introducción semanal. Los cinco pasos visibles eran recuperación, test de T3.03 (tema visto), preguntas variadas de temas vistos, revisión de errores y repasos vencidos. Comprobar si falta la actividad de tema nuevo o si la etiqueta/motivo sigue otra regla.
3. **Excepción 2–5/11/2026:** la vista mensual mostró 120 minutos disponibles los días 2, 3, 4 y 5, con enfoques ordinarios; no mostró la excepción vacacional comunicada para esas fechas (08:00–15:00). Comprobar si existe en otro evento o calendario o si no se incorporó. No editarla sin autorización.
4. **Entrada a Lectura atenta:** abrir su ruta presentó directamente una actividad en el paso 1 de 8, sin pantalla previa de inicio. No se respondió y el progreso visible era 0. Comprobar si es intencional y si salir sin contestar crea un registro.
5. **Actividad planificada sin material ejecutable:** «Comenzar sesión» inició el paso Recuperación activa y abrió `/cards?dailyTraining=activeRecall` con «No hay tarjetas disponibles para esta actividad dentro de los temas vistos». No ofrece en esa pantalla un control para omitir o seleccionar otro material; volver a Inicio/Planificación conserva el paso en curso y el contador sigue en 0/5. Confirmar si el plan debe excluir/reemplazar la actividad cuando no hay tarjetas.
6. **Enlace de paso sin filtros preparados:** el recurso «Test por tema» del paso «Preguntas del tema prioritario · T3.03» llevó a `#/test` sin parámetros de contexto. La configuración mostró 18 temas seleccionados; en el recorrido corto posterior la primera pregunta fue de T2.03, no de T3.03. Reproducido en UI; falta decidir si es bug o selección intencional que debe hacerse más visible.
7. **Pausas no visibles en el presupuesto:** las cinco duraciones suman los 120 minutos disponibles (24 + 36 + 24 + 24 + 12) y no aparece un bloque de descanso dentro de la sesión. Confirmar si las pausas están incluidas en esos tiempos o si la agenda ocupa las dos horas enteras con tareas.
8. **Justificación de respuesta:** la corrección y la revisión mostraron la opción correcta y la nota «Número de norma ISO de ODF», además de la procedencia del examen; no se mostró una explicación de por qué es correcta. Comprobar si existe otra vista de explicación para esta pregunta.
9. **Nota editorial de pregunta oficial:** en el segundo test, una pregunta oficial de T3.03 mostró literalmente «Nota de la pregunta = 2022 L P40.». Revisar esa nota contra la fuente original antes de clasificarla como errata; no se abrió aviso de error.
10. **Denominador del porcentaje en resultado:** al cerrar el segundo test (3 aciertos, 6 fallos, 1 blanco), Resultado mostró 33 % de acierto sobre lo contestado y Progreso listó la sesión con 30 %. Puede corresponder a denominadores distintos (contestadas frente al total); confirmar que la etiqueta del 30 % lo hace explícito y que no se interpreta como contradicción.

La observación usó la misma sesión autenticada de Chrome. No se respondieron preguntas, calificaron tarjetas ni cambiaron preferencias; Firebase no se inspeccionó directamente.

> Nota cronológica: la línea anterior describe la pasada de solo lectura de Sesión 1. En Sesión 4, autorizada dentro del recorrido, sí se crearon intentos sintéticos y una tarjeta; véase el resultado detallado más abajo. La diferencia posterior entre el contador inicial de Inicio y la pantalla Tarjetas se conserva como candidata.

11. **Resumen de valoración de tarjeta:** califiqué «Dudaba»; el resumen reflejó 1 dudaba pero también mostró «marqué “lo sabía”». El porcentaje era un agregado independiente sobre las tarjetas de la sesión, no la valoración de la última tarjeta. Se aclaró la etiqueta para explicitar el denominador; la programación FSRS sigue usando cada valoración individual.
12. **Mínimo temporal en Lectura atenta:** apareció transitoriamente «Lectura mínima: 1793703941 s» con opciones desactivadas y luego desapareció, habilitándose las opciones. Repetir con estado controlado y revisar valor/unidades antes de clasificar.
13. **Elegibilidad del informe de estrategia:** el cálculo afirma muestra insuficiente aunque enseña 296/20 respuestas elegibles y 18/3 sesiones (y proporciones similares por estrategia). Causa confirmada: `recommendation` también es nula si el segmento mezcla modalidades que no son solo simulacro o si el valor esperado empata con el blanco; la vista atribuía ambos casos a muestra insuficiente. La respuesta del dominio ahora explica cada causa.
14. **Divergencia tarjetas/pendientes:** tras crear y repasar una tarjeta de prueba, Tarjetas mostró 1 en repaso, 0 vencidas/nuevas y «0 tarjetas» disponibles para empezar; Inicio siguió con 26 pendientes. Determinar si son métricas distintas y rotularlas de forma inequívoca.
15. **Estado de sincronización contradictorio:** Ajustes y Diagnóstico mostraban «sincronizado» y hora 12:10:33, pero en la misma vista aparecía «No se pudo guardar en la nube (permission-denied)». El código confirma que el timestamp se actualiza con datos recibidos y que un error de escritura puede coexistir con ese estado. No prueba qué documento remoto falló ni que Firebase se haya leído. La UI ahora dice «Recepción activa», «último dato recibido» y ofrece reintentar si existe un error, incluso si la recepción sigue activa.
16. **Continuación de sesión planificada:** Inicio no ofrece CTA para retomar la sesión pausada; Planificación presenta «Comenzar sesión» pese a indicar la actividad «en pausa», 0/5 y 0:28. No se pulsó para proteger el checkpoint. Confirmar si la acción reanuda y mejorar el estado/CTA si no es obvio.
17. **Contador de respuestas tras blancos:** un simulacro de 40 preguntas con 1 respuesta y 39 blancos elevó «respuestas registradas» de 2090 a 2130. Puede ser el contrato de contabilizar exposiciones, pero la etiqueta no aclara que incluya blancos; comprobar agregación y documentación.
18. **Aviso editorial de pregunta:** el aviso existente `AS08B-P1-07` informa «Opciones repetidas o dos correctas» sobre composición del Gobierno; en las opciones visibles B y D son muy parecidas y la opción D figura como correcta. Requiere cotejo editorial con la fuente antes de declarar dos respuestas válidas o corregir el banco. No modificar ni resolver el aviso durante la comprobación.

### Resolución técnica de señales — 2026-11-03

La comprobación estática y las regresiones automatizadas confirman estos defectos de interfaz/flujo y sus correcciones locales:

- **5 — recuperación sin tarjetas:** el paso `activeRecall` abría Tarjetas y, si el inventario seleccionado estaba vacío, la única salida volvía a Inicio, dejando el checkpoint sin una alternativa ejecutable. Ahora el estado vacío ofrece practicar preguntas de los temas vistos, conservando `trainingSessionId`/`trainingActivityId`; `TestPage` auto inicia esa práctica y el Resultado completa el mismo paso. También se corrigió el enlace de retorno a Planificación.
- **2 — propósito que no refleja la agenda:** Planificación usaba el enfoque semanal del día para prometer «avanzar en el tema nuevo», aunque la lista efectiva de la sesión no contuviese `newContent`. Ahora el propósito se deriva de las actividades realmente planificadas.
- **12 — reloj inicial de Lectura atenta:** `clock` empezaba en cero, mientras el tiempo mínimo se calculaba con `Date.now()`, de modo que el primer render podía enseñar segundos desde 1970. Ahora el reloj nace con la hora actual y se actualiza mientras las opciones están activas.
- **13 — explicación incorrecta de recomendación:** el dominio puede suprimir la recomendación por muestra pequeña, por datos que no son exclusivamente de simulacro o por empate con el blanco. Ahora expone un motivo y la vista presenta el caso correspondiente.
- **15 — estado de sincronización:** el estado recibido no representa el resultado de cada escritura. Ahora la UI separa recepción de errores de escritura y deja visible el reintento cuando hay error. La fuente fue inspección de adaptadores/UI, no lectura de Firestore.
- **11 — porcentaje de tarjetas:** no se detectó cálculo erróneo: el total y los conteos sí coincidían; era un porcentaje agregado de respuestas «lo sabía». Se aclaró el texto para que el lector entienda qué se está contando.

Las demás señales no se convierten en defectos sin evidencia adicional: (1) Inicio, Tarjetas, falladas y preguntas pendientes cuentan conjuntos distintos; (3) no se encontró evento vacacional en la configuración visible y no se alteró; (4) abrir Lectura atenta directamente en un ejercicio es el flujo diseñado, y no se comprobó que salir sin responder cree registro; (6) el controlador de Planificación sí incluye tema y modalidad en sus rutas generadas, por lo que la apertura genérica no se reprodujo; (7) hay controles de pausa/descanso, aunque la vista de distribución no hace visible una pausa planificada entre actividades; (8) la explicación depende del ítem y algunas respuestas solo tienen clave/nota; (9) la nota `= 2022 L P40.` es opaca, pero no se cambió contenido sin cotejo editorial; (10) 33% de respondidas frente a 30% del total son denominadores distintos; (14) Inicio y Tarjetas etiquetan distintas colas; (16) el código ofrece «Continuar actividad» para checkpoint pausado, pero la acción no se pulsó en la cuenta; (17) «respuestas registradas» puede incluir exposiciones en blanco; y (18) queda pendiente la revisión editorial de `AS08B-P1-07` con el PDF primario de T1.03. No se infiere escritura, seguridad o causa Firebase por los mensajes observados.

La revisión documental de la señal 18 usó únicamente `/Volumes/SSD/Google Drive/TEMARIO_OPOSICION/01_Temario/T1.03 Gobierno/T1.03 Gobierno - Temario OPO.pdf`. El temario reproduce el art. 98 con «Vicepresidentes, en su caso» y explica que la Ley del Gobierno no ha desarrollado la cláusula de otros miembros. La opción D coincide con esa formulación; la B difiere en singular. Esto orienta el cotejo, pero no basta para resolver si la redacción de la academia admite dos respuestas: el aviso `AS08B-P1-07` sigue pendiente y no se modificó.

**Pruebas añadidas:** alternativa diaria sin tarjetas y continuidad del ID de actividad; cronómetro inicial de Lectura atenta; motivos del informe de estrategia; recepción/error/reintento de sincronización; propósito fiel al contenido de la sesión. **`npm run check`** pasó: arquitectura sin deuda nueva (2 excepciones ya conocidas), ESLint, control de exclusiones, TypeScript, 947 pruebas aprobadas/27 omitidas (183 archivos aprobados/1 omitido). Se mantiene el aviso jsdom `window.scrollTo` en una prueba de tarjetas. No se ejecutó E2E autenticado ni se validó móvil, offline, Firebase o escritura remota; tampoco se continuó ni modificó la sesión diaria pausada. No se hizo commit ni deploy.

### Resultado manual de Sesión 3 — primer recorrido (parcial; 2026-11-03)

- Configuré un test de 10 preguntas, solo con origen Oficial, manteniendo los 18 temas ya seleccionados. La pregunta 1 fue de T2.03 Estructuras de Datos, con procedencia «Promoción interna OEP 2022 (2023)».
- Respondí C. La aplicación mostró inmediatamente «¡Correcto!», deshabilitó las opciones y ofreció señales de confianza/duda y acciones de revisión. No registré confianza, duda ni aviso de error.
- «Salir» advirtió que lo respondido se guardaría como sesión interrumpida. Confirmé la salida; Resultado mostró 1/10 respondidas, 1 acierto, 0 fallos, 9 blancos, 10/100 de puntuación global y 100 % de acierto sobre lo contestado. La revisión indicó la respuesta C como correcta y la nota de pregunta ya indicada.
- Progreso pasó de 2075 a 2076 respuestas registradas y añadió la sesión Test del 3/11 con 10 puntos (10 %). Esto confirma persistencia visible en la app; no prueba la escritura remota de Firebase.
- Restablecí la configuración visible del test a su estado previo (tiempo, 20 min y los tres orígenes habilitados). No se respondió el resto de las preguntas ni se alteró la cobertura de temas.
- Abrí una segunda práctica de 10 preguntas con la configuración ya restaurada. Sin responder, recargué Chrome: apareció «Tienes sin terminar “Test” (1/10). ¿Continuar donde lo dejaste?». Al continuar, volvió a la pregunta 1/10 y mantuvo el mismo enunciado. Esto verifica recuperación visible del estado sin respuesta; no mide persistencia remota ni tiempo exacto. Dejé ese intento abierto, sin contestar ni salir, para no añadir otro resultado artificial al historial.

### Continuación de Sesión 3 — corrección y cierre (2026-11-03)

- Retomé el segundo test y probé opción descartada, confianza «Entre dos»/«Adivino», respuestas correctas e incorrectas, «No lo sé», «Acerté dudando», «Fue suerte», «Dudaba entre dos» y «Marcar como dudosa». Son datos sintéticos de QA en la cuenta, no evidencia de aprendizaje. «No lo sé» avanzó y quedó como blanco; el mapa reflejó el contador actualizado. Las opciones quedaron deshabilitadas tras responder; volver a pulsar la opción deshabilitada no incrementó el total.
- En respuestas erróneas se mostró la opción correcta, etiquetas de trampa, fragmentos rotulados «Temario» y el aviso «Cita del temario disponible, sin enlace verificado al PDF». En otras preguntas la explicación fue más breve o solo incluyó una nota; la disponibilidad/formato varía según la pregunta. No envié avisos de error ni creé tarjetas.
- La respuesta guardada y su corrección sobrevivieron a una recarga: el diálogo dijo «Tienes sin terminar “Test” (4/10)»; Continuar volvió a la pregunta 4/10 con la misma respuesta, confianza, corrección y fragmento temático. No aparece control de pausa en el quiz; la continuidad se comprobó mediante recarga.
- Cerré 10/10: Resultado mostró 3 aciertos, 6 fallos, 1 blanco, 33 % sobre respondidas y 10/100 con la fórmula visible `100 × (aciertos − fallos/3) / total`. La lista de revisión distinguió las 9 respondidas y el blanco, y expandir elementos mostró opciones, confianza, fragmento de temario y el límite de procedencia. Progreso pasó a 2085 respuestas; la última sesión figura como Test, 10 puntos y 30 %. No se leyó Firebase directamente.
- La señal editorial 8 queda matizada: la primera pregunta solo tenía nota breve; otras sí desplegaron texto temático con cautela de cita no verificada. Se añade como candidato separado la nota opaca de la pregunta oficial «= 2022 L P40.» y la diferencia visible 33 % (respondidas) frente a 30 % (total del test) para revisar la claridad del denominador.

La sesión 3 queda completa en navegador para este recorrido, no como validación de sincronización Firebase, segundo navegador ni todos los bancos/preguntas. El primer intento interrumpido y el segundo test completo quedan en el historial. Se dejaron las preferencias visibles del test restauradas; la sesión diaria de planificación permanece pausada.

## Matriz de cobertura de rutas

| Área/ruta | Recorrido mínimo |
|---|---|
| Inicio `/home` | estado inicial, accesos, sesión rápida sin empezar en sesión 1 |
| Planificación `/planificacion` | horizonte, semana/mes, propuesta, actividad, pausa, reanudación, repaso |
| Temario `/temario` | temas, material, índice, cobertura parcial y nueva/antigua según autorización |
| Test `/test`, Quiz `/quiz`, Resultado `/result` | filtros, intento, respuesta/corrección, reanudación y cierre |
| Simulacros `/sim`, `/sim2`, `/examenes` | selección, reglas, cronómetro, pausa, resultado, revisión |
| Tarjetas `/cards`, Falladas `/falladas` | recuperación, valoración, cola, filtros y rachas |
| Entrenadores `/lectura`, `/trampas`, `/relampago` | inicio, tarea, feedback, salida |
| Estadísticas `/stats` | vacíos, filtros, gráficos, separación por tipo de evidencia |
| Errores `/errores` | lista/estado vacío y acceso desde pregunta; envío real solo con cuenta de prueba/autorización |
| Ajustes `/settings` | lectura segura; guardar solo cambios aprobados |
| Accesos `/acceso` | permisos y estado actual; inicio de sesión lo realiza el usuario; operaciones administrativas excluidas |
| Ayuda `/ayuda` | índice, anclas, navegación y accesibilidad por teclado |
| Curación `/curar-contenido` | autorización/estado vacío owner-only; sin publicar |
| Shell PWA/red | recarga, aviso sin red y retorno; sin limpiar datos/caché |

## Criterio de cierre

Se dará por completada la prueba manual cuando cada área accesible tenga resultado y evidencia observada; los flujos bloqueados por permisos o entorno quedarán explícitos, sin marcarse aprobados. Deben constar los cambios persistidos autorizados y la diferencia entre estado local y sincronización. Este recorrido no sustituye `npm run check`, E2E automatizado, reglas de Firestore Emulator ni pruebas en dispositivo móvil físico.

## Registro de ejecución

| Sesión | Fecha | Estado | Entorno/viewport | Hallazgos y acciones persistentes |
|---|---|---|---|---|
| 1 — Solo lectura | 2026-11-03 | Parcial | Chrome autenticado, escritorio; `tai-oposicion.firebaseapp.com` (entorno no confirmado independientemente) | Navegación observada en Inicio, Planificación, Temas vistos, Progreso, Test, Simulacros, Tarjetas, Falladas y Ajustes. Se abrió Lectura atenta sin responder (0/8). Sin envíos ni cambios intencionados. Anomalías trasladadas a sesión 8. |
| 2 — Planificación/Temario | 2026-11-03 | En curso, pausa/reanudación observadas | Chrome autenticado, escritorio | Objetivo visible: 2027-06-30. Plan diario: 120 min y 5 pasos; semana ordinaria 120 min lunes–sábado y domingo descanso. Catálogo UI: 36 temas, 19 marcados vistos; la pantalla lista temas y marcas/resultados, sin acceso visible a materiales o apartados. Vista mensual: 2–5/11 muestran 120 min. «Revisar propuesta» sin fecha propuso tarjetas de 20 min para T1.01 el 4/11; se canceló, sin guardar. Al iniciar, Recuperación activa abrió una actividad sin tarjetas y no avanzó (0/5). Se pausó en 0:20, recargó conservando actividad/tiempo, se reanudó y pausó de nuevo en 0:28. El enlace del paso Test T3.03 abrió configuración genérica con 18 temas, sin acotar la práctica. La sesión queda pausada en la cuenta para no perder continuidad; no se contestaron preguntas ni cambiaron marcas. |
| 3 — Práctica/corrección | 2026-11-03 | Completa para el recorrido; Firebase y cobertura exhaustiva no verificados | Chrome autenticado, escritorio | Primer test interrumpido (1 correcta/10) y segundo completado (3 aciertos, 6 fallos, 1 blanco). Probados recuperación tras recarga antes y después de responder, feedback, confianza/duda, «No lo sé», descarte, intento de doble envío, señales de repaso y resultado. Aumento visible 2075→2085 respuestas. Ambos intentos permanecen en historial. |
| 4 — Repasos/estadísticas | 2026-11-03 | Completa para recorridos observados; sincronización y otros dispositivos no verificados | Chrome autenticado, escritorio | Falladas/racha, creación y revisión de tarjeta, recarga/reanudación; Lectura atenta, Detective de trampas, Relámpago; Progreso, gráficas y análisis de estrategia. Se añadieron intentos sintéticos y una tarjeta al historial visible; no se limpió progreso. Cuatro señales nuevas en sección 8. Sesión diaria de Sesión 2 intacta y pausada. |
| 5 — Simulacros/papel | 2026-11-03 | Parcial; Parte 2 y registro en papel no verificados | Chrome autenticado, escritorio | Catálogo y configuración observados; intento 40 preguntas/45 min interrumpido tras una respuesta, con pausa y recarga que restauraron estado. Resultado guardado: 1 fallo, 39 blancos, −0,8/100. Configuración visible restaurada. Sin validación Firebase. No se encontró flujo de registro/corrección de test en papel en Simulacros/Ayuda. |
| 6 — Ajustes/acceso/offline | 2026-11-03 | Parcial; sincronización y offline no verificados | Chrome autenticado, escritorio | Leídos Ajustes, Diagnóstico y Accesos sin guardar nada. La UI mezcla «sincronizado» con `permission-denied`; descarga offline 39/41 con `cards/index.json` y `explanations/index.json` ausentes. Sin logout, acciones owner, actualización, descarga, exportación, importación, borrado ni desconexión. Firebase no leído. |
| 7 — Cierre | 2026-11-03 | Completa para regresión visible; sin nuevas respuestas | Chrome autenticado, escritorio | Sesión diaria continúa pausada 0/5, 0:28; simulacro de 40Q es primera sesión en Progreso. Contadores Inicio: 1512 preguntas vistas, 19 temas, 27 tarjetas, 297 repasos, 520 falladas; Progreso: 2130 respuestas, 57%. Errores del banco: 1 pendiente `AS08B-P1-07`; no resuelto/exportado. Sin cambios de datos ni validación Firebase. |
| 8 — Comprobación de anomalías | 2026-11-03 | Clasificación estática y pruebas locales completa; navegador/Firebase no repetidos | Repositorio y PDF local de T1.03; sin escrituras | Se corrigieron las señales 2, 5, 12, 13 y 15; se aclaró la métrica 11. El resto se conserva como diferencia de definición, flujo intencional o pendiente editorial/operativa. Detalle y límites en «Resolución técnica de señales». La sesión diaria original sigue pausada, sin abrirla ni completarla. |

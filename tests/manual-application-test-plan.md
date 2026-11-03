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

### Sesión 5 — Simulacros Parte 1, Parte 2 y pruebas en papel (30–60 min; examen completo opcional)

**Con autorización expresa antes de crear un resultado persistente:**

- Recorrer catálogo, modalidades, selección por examen/tema, filtros, configuración de preguntas, duración, opciones y política de puntuación visible.
- Hacer un recorrido corto si la UI lo permite: iniciar, contestar, dejar blanco, navegar, pausar/retomar y finalizar; comprobar corrección solo al cerrar, resultado, análisis y revisión.
- Abrir Parte 2 y comprobar selección/resultado cuando existan supuestos disponibles.
- Registrar un tramo de test en papel: duración y respuestas según el flujo disponible; confirmar que se puede corregir con clave conocida o dejar parámetros de penalización incompletos sin mostrar nota neta definitiva.
- Un simulacro completo de 100 preguntas/90 minutos es opcional por su duración y por dejar un resultado permanente en historial; no se inicia automáticamente.

**Salida:** modalidad, reglas de puntuación, resultados y límites visibles; el historial de prueba queda identificado como tal si se autoriza.

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

### Sesión 7 — Cierre y regresión de navegación (15–25 min)

- Volver a Inicio y recorrer las rutas con los datos de prueba existentes, sin crear nuevos intentos.
- Revisar sesiones abiertas/pausadas, eventos programados, errores recuperables y consistencia básica del historial.
- Confirmar con el usuario si se conserva el progreso de prueba autorizado o si quiere retirar alguna actividad reversible desde las opciones normales de la aplicación. No borrar datos directamente.
- Completar la matriz de cobertura, listar fallos reproducibles, bloqueos por permisos/red/entorno y flujos que no se pudieron ejecutar.

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
| 1 — Solo lectura | Pendiente | Pendiente | Pendiente | Ningún cambio previsto |
| 2 — Planificación/Temario | Pendiente | Pendiente | Pendiente | Requiere autorización antes de guardar |
| 3 — Práctica/corrección | Pendiente | Pendiente | Pendiente | Requiere autorización para intentos |
| 4 — Repasos/estadísticas | Pendiente | Pendiente | Pendiente | Requiere autorización para actualizar progreso |
| 5 — Simulacros/papel | Pendiente | Pendiente | Pendiente | Simulacro completo opcional; deja historial |
| 6 — Ajustes/acceso/offline | Pendiente | Pendiente | Pendiente | No ejecutar acciones administrativas reales |
| 7 — Cierre | Pendiente | Pendiente | Pendiente | Sin nuevos datos de prueba |

# Registro de hallazgos TAI

## Implementación Astra 2026-11-05

La auditoría original se conserva íntegra en `evidence/astra-implementation-2026-11-05/astra-original.zip`, junto a su SHA-256 en `provenance.json`. Contiene 16.078 dictámenes y 3.519 incidencias editoriales. `implementation-tasks.json` registra cada ID, prioridad, evidencia, dependencias, riesgo y aceptación. Sus decisiones editoriales requieren verificar las cuatro alternativas de cada pregunta. La publicación del banco en Firestore necesita autorización específica.

|ID original|Hallazgo y causa|Solución y ámbito|Estado|Verificación|
|---|---|---|---|---|
|TEC-01|La reconstrucción desde Drive pierde correcciones y marcas np.|Manifiesto de bytes aprobados, inventario completo, preservación de la edición corregida, candidatos fuera de public y validación antes de la primera petición remota.|CORREGIDO Y VERIFICADO|Reconstrucción aislada, drift, alias, exclusiones y publicador offline.|
|TEC-02|La práctica configurable presenta reloj y nota por parte como examen completo.|Reconstrucción de parejas de supuestos de la misma convocatoria, reservas activadas, perfil oficial con cortes y fórmula documental.|CORREGIDO Y VERIFICADO|Pruebas de selección, reloj y baremos.|
|TEC-03|np afecta nota, intentos y estadísticas en práctica.|Excluir de denominadores e intentos, mostrar solo consulta, filtrar entrenadores.|CORREGIDO Y VERIFICADO|Motor, componentes y 2 recorridos de navegador por motor; Auth/Firestore con dos alumnos ficticios.|
|TEC-04|Detector parcial de figuras omitidas.|Bloqueo de candidatos y cinco exclusiones de evaluación comprobadas en fuentes. Conserva consulta y motivo. Restituir los adjuntos históricos sigue abierto.|CORREGIDO Y VERIFICADO|Las omisiones históricas conservan sus dictámenes por ID.|
|TEC-05|El mismo ID puede reanudarse contra otra clave.|Huella de evaluación ordenada con texto, alternativas, clave y np. Guardado antiguo con respuesta numérica sin huella caduca con aviso.|CORREGIDO Y VERIFICADO|Cambio solo de clave, orden, np, legado, progreso histórico y recarga en Chromium/WebKit.|
|TEC-06|La marca externa verificada y la coincidencia de cita aprueban sin suficiente revisión.|Separar candidatos, documento/hash/página/pasaje, rechazo determinista y revisión independiente vinculada a la propuesta completa.|CORREGIDO Y VERIFICADO|Pipeline Python y candidatos preparados sin acceso remoto.|
|TEC-07|Redondeo ponderado omite temas elegibles y familias.|Asignación factible con cobertura por tema y selección sin variantes repetidas, manteniendo filtros.|CORREGIDO Y VERIFICADO|Casos de capacidad, distribución, alternativas y escenarios.|
|TEC-08|Metadatos de evidencia insuficientes.|Manifiesto lateral compatible para candidatos con fuente, revisión, patrón y justificación de cada opción.|CORREGIDO Y VERIFICADO|Contrato antiguo conservado y aceptación invalidada al cambiar contenido.|

Los estados locales y de producción se registran por separado. Una corrección local probada puede seguir pendiente de publicar en Firestore. Las pruebas documentales acreditan localización, y las decisiones semánticas sin prueba concluyente permanecen en revisión.

Se verificaron 13 correcciones factuales locales (10 P0, 2 P1 y 1 P2) y cinco exclusiones de evaluación por material ausente. Restan 3.501 incidencias editoriales sin corrección, de las que 427 son P0. El usuario autorizó explícitamente las 13 correcciones después de CI e integración. Su ejecución y readback se registran en el PR 107; las demás propuestas no quedan autorizadas por esa aprobación.

Verificaciones del candidato 1.1.13: arquitectura, ESLint, crecimiento de ignores, tipos y 989 unitarias aprobadas con 28 omitidas; ocho comprobaciones Python; Auth/Firestore 1/1; reglas 27/27; 10 recorridos de aceptación en dos motores. El original de main 6b8ce24 pasó 949 pruebas y 27 omitidas en una extracción aislada posterior para obtener referencia sin cambios ajenos. Los logs completos están en evidence/astra-implementation-2026-11-05/. La auditoría de dependencias detecta siete avisos moderados en herramientas de lint (minimatch y sus dependientes); no se actualizaron dependencias ni se aplicó audit fix forzado.

|ID nuevo|Hallazgo|Corrección|Estado|Prueba|
|---|---|---|---|---|
|TEC-09|Una recarga inmediata tras resetAll podía recuperar el espejo IndexedDB anterior.|Generación local por cuenta en snapshot y espejo; recuperación en curso invalida si cambia el estado. El aislamiento de fixtures se refuerza sin quitar comparaciones.|CORREGIDO Y VERIFICADO|Regresión de copia anterior y recuperación posterior de datos nuevos; 77 pruebas focalizadas, diez repeticiones de 61 pruebas cada una.|

Tras resolver TEC-09, la suite general suma 995 aprobadas y 29 omitidas, y el pipeline nueve pruebas. La generación desde planes construye enunciado y alternativas según uno de los seis patrones y conserva la respuesta al reordenar, con prueba de regresión. CI se repite contra este commit antes de integrar.

|TEC-10|WebKit retenía visibilidad obsoleta al montar selectores durante el arranque.|El indicador de listo espera dos fotogramas y cancela callbacks al desmontar. Conserva el bloqueo hasta resolver Auth.|CORREGIDO Y VERIFICADO|12 E2E, cinco unitarias y cuatro capturas idénticas byte a byte frente a 282f692. Arreglo derivado del commit estable ac71bea3; [incidencia del motor](https://bugs.webkit.org/show_bug.cgi?id=326092).|

|TEC-11|La recarga autenticada protegida podía redirigir y eliminar la sesión antes de resolver identidad y permiso; el logout podía volver a la ruta antigua.|Acceso resuelto explícito, reanudación diferida, caché vacía no equivale a revocación, guardado conservado y navegación de logout sin ruta obsoleta.|CORREGIDO Y VERIFICADO|SDK Auth/Firestore reales en emuladores, navegador Chromium con 100 IDs/respuestas/plazo, arranque sin caché y logout; unitarias de red, revocación y carga. Suite completa: 1.002 aprobadas, 29 omitidas.|

Handoff final de integración, publicación de las 13 correcciones autorizadas y despliegue: [PR 107](https://github.com/dramirodev/tai-oposicion/pull/107). Los 3.501 hallazgos editoriales restantes conservan sus IDs y estados originales; veinte propuestas adicionales verificadas permanecen fuera del banco publicado.

|TEC-12 (P1)|Revocar access con el mismo UID detenía la nube, pero el intento privado en memoria seguía admitiendo respuestas y nota local.|Suspensión sin finalizar ni puntuar, checkpoint conservado, muestra pública separada y reanudación con permisos/contexto verificados. Contrato extendido con publicSample opcional; legado privado requiere permiso y el guest conserva compatibilidad.|CORREGIDO Y VERIFICADO|1.004 pruebas, 29 omitidas; Auth/Firestore Chromium 1/1 con revocación/reconcesión y 100 IDs/respuestas/plazo. Histórico por ID/contexto recuperable, callbacks obsoletos sin nota, attemptSession sigue active.|

Seguimiento de la prueba Auth heredada: el refuerzo de T1.02 está primero, con 72 minutos, valoración Parcialmente y fecha correcta. La expectativa nth(1) era obsoleta; se localiza la actividad por título y se conserva el resto del recorrido. Chromium pasó el cambio de día, logout y aislamiento de la segunda cuenta en Auth/Firestore Emulator. Ambos escenarios Auth se incluyen en la configuración dedicada de CI. Fuente del arreglo de test: ac71bea3.

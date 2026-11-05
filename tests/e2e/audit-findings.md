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

Se verificaron 13 correcciones factuales locales (10 P0, 2 P1 y 1 P2) y cinco exclusiones de evaluación por material ausente. Restan 3.501 incidencias editoriales sin corrección, de las que 427 son P0. La publicación de las 13 correcciones en Firestore sigue pendiente de autorización específica.

Verificaciones del candidato 1.1.13: arquitectura, ESLint, crecimiento de ignores, tipos y 989 unitarias aprobadas con 28 omitidas; ocho comprobaciones Python; Auth/Firestore 1/1; reglas 27/27; 10 recorridos de aceptación en dos motores. El original de main 6b8ce24 pasó 949 pruebas y 27 omitidas en una extracción aislada posterior para obtener referencia sin cambios ajenos. Los logs completos están en evidence/astra-implementation-2026-11-05/. La auditoría de dependencias detecta siete avisos moderados en herramientas de lint (minimatch y sus dependientes); no se actualizaron dependencias ni se aplicó audit fix forzado.

|ID nuevo|Hallazgo|Corrección|Estado|Prueba|
|---|---|---|---|---|
|TEC-09|Una recarga inmediata tras resetAll podía recuperar el espejo IndexedDB anterior.|Generación local por cuenta en snapshot y espejo; recuperación en curso invalida si cambia el estado. El aislamiento de fixtures se refuerza sin quitar comparaciones.|CORREGIDO Y VERIFICADO|Regresión de copia anterior y recuperación posterior de datos nuevos; 77 pruebas focalizadas, diez repeticiones de 61 pruebas cada una.|

Tras resolver TEC-09, la suite general suma 995 aprobadas y 29 omitidas, y el pipeline nueve pruebas. La generación desde planes construye enunciado y alternativas según uno de los seis patrones y conserva la respuesta al reordenar, con prueba de regresión. CI se repite contra este commit antes de integrar.

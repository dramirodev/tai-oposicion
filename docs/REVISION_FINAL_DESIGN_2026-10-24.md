# Revisión final de Design en móvil y tableta

## Alcance y versión

Se contrastó el despliegue `1.1.3+827242b` con el checkout del mismo commit antes de editar. No había modificaciones ajenas pendientes. En producción el navegador estaba sin sesión: se recorrieron Inicio, menú, Ajustes y la sesión rápida de invitado, cerrada sin registrar respuestas. Las pantallas completas se recorrieron en localhost con los registros locales de prueba, sin entrar en una cuenta real ni modificar datos de producción.

## Hallazgos corregidos

| ID | Prioridad | Problema reproducido | Corrección |
| --- | --- | --- | --- |
| D01 | Alta | A 320 px y letra máxima, la cabecera del simulacro alcanzaba 422 px y Pausar quedaba fuera de pantalla; Siguiente recortaba texto. | Cabecera temporizada en dos filas con letra ampliada; acciones inferiores apiladas y espacio inferior suficiente, con reserva mayor para las tres valoraciones de tarjetas. Tras corregir: documento 305 px en viewport de 320 px, Pausar completamente visible y botones sin texto desbordado. |
| D02 | Media | Cambiar pestaña de Simulacros, marcar revisión o saltar/cambiar pregunta podía dejar el foco en el documento. | Foco inmediato en la pestaña o marca nueva; encabezado de pregunta al saltar, avanzar o retroceder. |
| D03 | Media | Tarjetas no tenía encabezado durante la sesión y perdía el foco al mostrar respuesta, valorar y terminar. | Encabezado accesible con posición; región de respuesta con nombre y foco; resumen final enfocado. |
| D04 | Media | Tocar el desplegable del supuesto en el frente de una tarjeta disparaba también el giro y revelaba la respuesta. | El giro por clic excluye controles, enlaces y desplegables. Regresión con tarjeta real `TAI2024B-S1-01`. |
| D05 | Media | Relámpago y Lectura perdían el foco al deshabilitar opciones o cambiar de paso. | Acción siguiente enfocada sin desplazar la página; encabezado en pasos/resúmenes nuevos; Detective mantiene su desplazamiento hacia la corrección. |
| D06 | Media | Pausar medía 32 px de ancho, Cerrar menú 34; resúmenes de revisión/contexto 22 px de alto y fecha objetivo 21. Algunas casillas se comprimían junto a etiquetas largas y palabras cortas tenían 26 px de ancho. | Mínimo 44 px en botones de icono, desplegables y palabras; fecha de 48 px; casillas sin compresión. Revisión posterior sin esos controles pequeños en las vistas corregidas. |
| D07 | Baja | Menú y badge anunciaban «1 tarjetas» o «1 pendientes»; menú y navegación daban nombres distintos a Progreso. | Singular/plural correcto y rótulo Progreso coherente. |

El mapa ya tenía límite de altura del 40 % del viewport: se conservó. No se cambian claves, respuestas, identificadores ni reglas de progreso. La marca de temario y los tres aciertos seguidos mantienen su comportamiento.

## Pantallas recorridas

Capturas y mediciones a 390×844 y 1024×900. Se hicieron comprobaciones adicionales a 320×720 y 768×1024, con letra máxima y modo oscuro en los puntos de mayor riesgo.

| Pantalla o estado | Cobertura |
| --- | --- |
| Inicio con/sin progreso, menú | Móvil y tableta; producción como invitado y local con acceso completo. |
| Ajustes y diagnóstico, objetivo, descarga y copias | Móvil y tableta; letra máxima/oscuro y 320 px. Importación destructiva y borrado no se ejecutan sobre datos del usuario. |
| Test: selección, pregunta, corrección, salida y resultado interrumpido | Móvil y tableta; datos de prueba. |
| Simulacros: completo, examen y tema | Móvil y tableta; foco de pestañas comprobado después de corregir. |
| Simulacro en curso, mapa, revisión y pausa | Móvil y tableta; reflujo adicional a 320 px con letra máxima. |
| Parte 2: elección, pregunta y contexto del supuesto | Móvil y tableta; contexto abierto y cerrado. |
| Falladas y detalle | Móvil y tableta; marca externa, filtros y práctica cubiertos además por pruebas automatizadas. |
| Tarjetas: selección, frente, respuesta, valoración y fin | Móvil y tableta; foco y región de respuesta comprobados después de corregir. |
| Temario | Móvil y tableta; búsqueda/bloques y marcas conservadas. |
| Progreso: temas, simulacros, evolución y tabla | Móvil y tableta; estados de pocos datos y sin simulacros. |
| Relámpago: pregunta y corrección | Móvil y tableta. |
| Detective: pregunta, corrección y resumen de ocho ejercicios | Móvil y tableta. |
| Lectura: tres pasos y correcciones | Móvil y tableta; recorrido completo de ocho ejercicios hasta su resumen. |
| Errores del banco | Móvil y tableta, estado vacío. |
| Gestión de accesos del propietario | No disponible sin autenticación; no se ha simulado una cuenta ni cambiado permisos. No se afirma una validación en producción de esta pantalla. |

## Contraste medido

Ratios de los tokens efectivos contra la superficie de tarjeta (no una certificación de todos los elementos):

| Elemento | Claro | Oscuro |
| --- | ---: | ---: |
| Texto principal | 15,97:1 | 14,22:1 |
| Texto secundario | 5,93:1 | 6,44:1 |
| Enlaces | 6,31:1 | 5,78:1 |
| Botón principal, texto/fondo | 15,97:1 | 7,90:1 |

## Verificación y límites

Verificación final local: **221 pruebas en 20 archivos**, comprobación de tipos, compilación y validación de tarjetas de los 36 temas correctas. Revisión independiente del diff: 26 pruebas específicas correctas, sin regresiones adicionales después de restaurar el desplazamiento de Detective y ampliar la reserva inferior de tarjetas.

Las regresiones de pestañas/mapa, tarjetas y entrenamientos se reprodujeron primero con pruebas fallidas. Las correcciones visuales se contrastaron con medidas y capturas antes/después en navegador. Evidencias de esta ejecución en `/private/tmp/tai-final-audit/`, incluyendo `simulacro-320-grande-antes.png` y `simulacro-320-grande-despues.png`.

Los tamaños representan viewport de navegador, no dispositivos físicos. No se ha validado VoiceOver, un iPad real ni una sesión autenticada de producción. Tampoco se ha sustituido el recorrido real por una afirmación de conformidad WCAG completa. La pantalla de accesos sigue pendiente de revisión con una sesión del propietario.

Comprobación adicional de las tres valoraciones a 390 px con letra máxima: reserva inferior de 340 px CSS; al final del desplazamiento, la ayuda termina en y=332,58 y la barra empieza en y=387,50, por lo que permanece visible. Lectura completó ocho ejercicios después de los cambios y su resumen se capturó a 390 y 1024 px con el foco en el encabezado.

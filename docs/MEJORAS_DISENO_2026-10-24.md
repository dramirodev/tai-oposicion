# Mejoras Design — revisión del 24/10/2026

Se conserva como base el rediseño integrado en `34c11e4` y la presentación de código de `cfd8095`. El ajuste posterior corrige la cancelación en la última pregunta, la expiración durante una confirmación y la comprobación de archivos offline dañados. No cambia identificadores, respuestas del banco, claves de almacenamiento ni reglas de repaso.

## Cobertura de las propuestas aprobadas

| Propuesta | Implementación |
| --- | --- |
| Inicio móvil legible | Dos columnas; una con letra grande, sin desbordamiento horizontal en la comprobación a 390 px. |
| Estados accesibles | Selectores con `aria-pressed`, actualizado tras repintar y con restauración del foco. |
| Detective | Opciones visibles para evaluar las etiquetas dependientes de ellas. |
| Advertencias históricas | Aviso antes de responder, conservando su exclusión de pruebas puntuables. |
| Resultado parcial | Sesión interrumpida, respondidas/total y acierto sobre contestadas; nota global sin modificar. |
| Prioridad del inicio | Continuar, repasar hoy, falladas y sesión rápida; entrenamientos agrupados. |
| Navegación | «Progreso» sustituye el rótulo ambiguo «Datos». |
| Falladas | Marca de temario fuera del desplegable, filtros de revisión y racha; tres aciertos seguidos, fallo reinicia, blanco neutro. |
| Selección del test | Todo el temario explícito, selección vacía deshabilitada y resumen junto a Empezar. |
| Temas | Búsqueda y bloques plegables; vistos y estudiados diferenciados. |
| Exámenes | Oficiales primero y filtros por origen/turno/año en la referencia. El año no se presenta como convocatoria verificada. |
| Navegación del examen | Mapa de respuestas, blancos y revisión, conservado al reanudar; contexto de supuesto lateral en pantallas amplias. |
| Corrección inmediata | Sin salto automático que oculte el enunciado; foco en Siguiente sin desplazarlo. |
| Tarjetas | Cantidad efectiva y siguiente intervalo por valoración, sin modificar el calendario al previsualizar. |
| Estadísticas | Resumen con acciones y secciones Temas/Simulacros/Evolución. |
| Leyendas | Nombres visibles además del color. |
| Lectura con teclado | Una entrada de Tab, flechas, Home/End y espacio, con instrucciones. |
| Fuentes | Enlaces HTTP(S) cotejados; referencia técnica diferenciada de cita/PDF. Sin páginas o enlaces locales inventados. |
| Ajustes | Grupos por tarea y diagnóstico técnico plegable. |
| Sin conexión | Inspección de caché de banco, supuestos y tarjetas; rechaza JSON ilegible, nulo o estructura básica incorrecta. Fecha solo tras descarga verificada. |
| Copias | Previsualización, confirmación y resumen; combinación conservando registros locales ausentes en la copia. |
| Cuentas y primer uso | Mensajes de acceso/sincronización y protección de operaciones pendientes al cambiar de cuenta. |
| Fecha objetivo | Configuración explícita de planificación; sin fecha oficial predeterminada supuesta. |
| Textos e iconos | Acciones y estados más claros; coherencia de navegación y cantidades en los flujos revisados. |

## Revisión adicional

- Cancelar Terminar ya no avanza el índice fuera de las preguntas ni escribe respuestas fuera de rango.
- Vencer el tiempo tiene prioridad sobre la confirmación; retira el diálogo y guarda una sola sesión.
- Una respuesta HTTP 200 con HTML/JSON corrupto no prueba disponibilidad sin conexión.
- El service worker pasa a `tai-v68` para distribuir la corrección conservando `tai-data`.

## Evidencias y límites

Pruebas automatizadas de flujos, entrenamiento, ajustes, estado por cuenta, resultados, tarjetas y almacenamiento; comprobación de tipos, compilación y validación de tarjetas. La revisión independiente no encontró más regresiones en el diff de las tres correcciones.

Recorrido de navegador a 390×844 y 1024×900: Inicio, Ajustes, Test y Simulacros, letra máxima y tema oscuro, navegación y recarga conservando los registros locales de prueba. Capturas guardadas en `/private/tmp/tai-design-final/` durante la revisión. No se han alterado datos de producción.

Estas verificaciones no certifican WCAG completo ni sustituyen VoiceOver o un iPad físico. No se ha ejecutado aquí el emulador de reglas de Firestore ni una prueba de inicio de sesión real. La disponibilidad offline inspecciona los datos; su comportamiento con el navegador completamente desconectado sigue requiriendo una prueba específica.

El prompt reutilizable para una segunda auditoría está en `docs/PROMPT_AUDITORIA_DESIGN_CLAUDE.md`.

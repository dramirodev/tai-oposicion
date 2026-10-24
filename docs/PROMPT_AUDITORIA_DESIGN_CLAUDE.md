# Prompt para auditar las mejoras Design en Claude

Actúa como auditor independiente de UX, accesibilidad y calidad de una PWA de preparación de oposiciones. Audita el checkout actual de PWA_TAI y el plan `docs/superpowers/plans/2026-10-24-mejoras-diseno.md`. Empieza por registrar rama, HEAD y estado Git: hay trabajo concurrente y debes conservarlo. No modifiques código, progreso ni banco; no hagas commit, push o despliegue.

Contrasta las propuestas aprobadas con el código real y con capturas del navegador. No des una propuesta por cumplida porque aparezca en la documentación o pase un test. Para cada punto informa: implementado, parcial, ausente o no verificable; evidencia de archivo/línea, reproducción y captura cuando corresponda; impacto y corrección recomendada.

Revisa primero las cinco prioridades:
1. Inicio móvil con dos columnas, una con letra grande; sin textos cortados ni desbordamientos.
2. Estado accesible de todos los selectores, también después de repintar; foco y teclado conservados.
3. Detective permite ver las opciones necesarias para evaluar sus etiquetas.
4. Advertencias históricas visibles antes de contestar; preguntas excluidas de simulacros puntuables disponibles para estudiar.
5. Sesión interrumpida identificada y respondidas/total visibles; puntuación global y acierto sobre contestadas separados, sin cambiar la fórmula oficial.

Después revisa:
- Inicio: continuar, repasar hoy, falladas, sesión rápida, entrenamientos agrupados, primer uso y estado de sincronización.
- Falladas: marca «Repasada en el temario» fuera del desplegable, independiente de la racha; filtros por estado y 0/1/2 aciertos. Exige tres aciertos seguidos para salir; un fallo reinicia, dejar en blanco es neutro. La práctica debe respetar los filtros.
- Test: todo el temario frente a selección explícita, búsqueda, bloques plegables, selección vacía y resumen junto a Empezar. Orígenes y número efectivo deben coincidir con la sesión creada.
- Simulacros: oficiales primero, filtros por origen, turno y año en la referencia sin inventar convocatoria; mapa de respondidas/blancos/revisión; contexto de supuestos en tableta.
- Cierre: cancelar desde la última pregunta conserva índice y respuestas; doble clic guarda una vez; vencimiento con confirmación abierta cierra y retira el diálogo; salida y reanudación coherentes.
- Tarjetas: número efectivo, cero temas vistos, fallos con contexto de supuesto, intervalo anticipado por valoración sin alterar el calendario antes de valorar.
- Progreso: resumen con siguiente acción, secciones Temas/Simulacros/Evolución, leyenda textual y tabla accesible; historial conservado.
- Lectura: una entrada de Tab al grupo de palabras; flechas, Home, End y espacio; instrucciones visibles.
- Fuentes: solo enlaces seguros cotejados; distinguir referencia técnica, cita y PDF/página realmente verificados. Nunca inventar rutas a PDF locales.
- Ajustes: grupos claros, diagnóstico plegable, objetivo de estudio explícito sin fecha oficial supuesta, importación con vista previa, confirmación y resultado.
- Sin conexión: comprobar cuerpos y estructura mínima de los archivos de preguntas, supuestos y tarjetas, no solo respuestas HTTP 200. Probar HTML, JSON corrupto, recursos ausentes, error de red y descarga incompleta; no mostrar fecha de éxito falsa.
- Seguridad del progreso: importar conserva registros ausentes; cambiar de cuenta durante lectura, confirmación, carga o entrenamiento no escribe en otra cuenta. Sin migraciones destructivas ni cambios en identificadores/respuestas del banco.
- Coherencia de plurales, iconos, botones, errores, estados vacíos y navegación «Progreso».

Prueba 320 y 390 px, tableta 768/1024 px, tema claro/oscuro, letra máxima, teclado, foco visible y reducción de movimiento. Mide contraste cuando lo afirmes. Distingue revisión estática, navegador emulado, lector de pantalla y dispositivo físico; no declares conformidad WCAG completa sin evidencia.

Ejecuta `npm test`, `npm run typecheck`, `npm run build` y `node scripts/validate_cards.mjs`; informa resultados exactos. Usa datos locales de prueba y nunca borres ni alteres el progreso real. No inicies sesión ni importes en producción.

Entrega hallazgos reproducibles ordenados por gravedad, una matriz de cobertura de todas las propuestas y límites de validación. Si no hay fallos, dilo sin inventar mejoras obligatorias. No apliques cambios: termina con las correcciones concretas recomendadas.

# Planificación de estudio

## Qué hace ahora

La página consume el plan diario del entrenador existente. Presenta las actividades ordenadas, permite comenzar o continuar la sesión y abre los flujos ya preparados de temario, tarjetas, test, fallos y repasos. La sesión conserva el paso, las marcas temporales y el tiempo medido por actividad en almacenamiento local; puede sincronizar ese checkpoint en el documento privado `users/{uid}/cfg/training` para cuentas aprobadas. No escribe respuestas, resultados ni datos del temario en ese documento.

La selección de práctica y dominio se limita a temas marcados como vistos. En días de contenido nuevo solo se propone el tema de introducción semanal elegido en Ajustes, si sigue sin marcarse como visto y existe en el catálogo. Sin elección explícita, no se asigna ningún tema automáticamente. Los resúmenes, esquemas y vídeos completos no forman parte del contenido disponible en TAI; el paso de estudio inicial enlaza al temario y explica que se debe consultar el material externo. Marcar un tema como visto registra cobertura declarada, no acredita que se haya leído o comprendido.

La repetición espaciada continúa utilizando FSRS para las tarjetas que ya lo tienen configurado. La planificación diaria no crea un segundo calendario de FSRS. El checkpoint de una sesión tampoco constituye un historial pedagógico o una evaluación de retención.

## Evidencia y límites

| Estrategia | Nivel de evidencia | Uso en TAI y límite |
|---|---|---|
| Recuperación mediante preguntas o tarjetas | Sólido y generalizable en una amplia variedad de tareas | Prioriza contestar o intentar recordar antes de consultar la solución. Las tarjetas y los tests existentes proporcionan feedback. Una pregunta tipo test mide reconocimiento además de recuperación y no equivale a recuerdo libre. |
| Distribuir la práctica en el tiempo | Sólido; el intervalo óptimo depende del plazo de retención y el material | Se reutilizan las fechas FSRS existentes para tarjetas. No se presenta la distribución semanal del producto como óptima ni se aplica FSRS a la lectura de temas completos. |
| Feedback correctivo | Bien respaldado junto a práctica de recuperación; su efecto depende de diseño y respuesta | Se conserva el feedback existente de preguntas y tarjetas. El plan no inventa explicaciones si falta el contenido. |
| Intercalar temas y contrastar conceptos | Dependiente del contenido y de la tarea | El test variado sobre temas vistos reutiliza el test existente. El algoritmo no afirma que mezclar cualquier tema mejore el aprendizaje. |
| Autoexplicación y reconstrucción de esquemas | Utilidad contextual | La interfaz invita a explicar o reconstruir sin apuntes, pero no califica esas acciones ni mide comprensión. No existe todavía contenido de esquemas enlazado o un instrumento validado para puntuarlas. |
| Lectura inicial o selectiva | Depende del objetivo y no debe dominar frente a recuperación | El paso de contenido nuevo remite a material del usuario. El banco actual no permite localizar secciones concretas de apuntes; no se inventan apartados ni se mide el tiempo real de lectura fuera de la app. |

## Reglas de producto (heurísticas, no resultados científicos)

- La semana predeterminada contiene seis días de estudio de hasta 120 minutos y domingo de descanso. Lunes, martes, jueves y viernes se enfocan en contenido nuevo; miércoles y sábado, en recuperación/consolidación. Es una configuración inicial editable, no una proporción recomendada por investigación.
- En un día de contenido nuevo, el plan propone el tema de introducción semanal seleccionado y no marcado como visto, y como máximo una actividad de refuerzo. Sin tema seleccionado no prepara contenido nuevo. Si hay repasos vencidos, prioriza esos repasos; después, fallos; después, tarjetas de Active Recall; por último, test del tema. La ponderación y el límite son heurísticas para reservar tiempo al temario y evitar llenar toda la sesión.
- En días de consolidación se usan únicamente temas marcados como vistos. Los resultados y tarjetas vencidas pueden priorizarse; cualquier clasificación de dominio hereda las limitaciones de los datos y no es una medición independiente de retención.
- Si faltan datos no se inventan resultados: una persona sin temas vistos recibe un paso de estudio inicial solo cuando ha elegido un tema semanal; si no hay tema elegido, repasos o preguntas disponibles, el plan queda vacío y explica por qué.
- El 30 de junio de 2027 se presenta solo como fecha estimada personal cuando el usuario no haya configurado una fecha objetivo. No se describe como fecha oficial del examen.

## Evaluación pendiente

Las pruebas automatizadas verifican las reglas de selección y el checkpoint, no que una distribución concreta cause mejores resultados de oposición. Para evaluar el efecto pedagógico hacen falta datos de uso reales y longitudinales, consentimiento y medidas diferenciadas: recuperación en material nuevo, retención diferida, cobertura y resultados de simulacro. `npm run measure:attempts` genera datos sintéticos y no puede usarse como evidencia de aprendizaje real.

## Referencias

- Dunlosky, J. et al. (2013). [Improving Students' Learning With Effective Learning Techniques: Promising Directions From Cognitive and Educational Psychology](https://doi.org/10.1177/1529100612453266). La revisión clasifica práctica de recuperación y práctica distribuida con alta utilidad general; la relectura aislada tiene utilidad limitada y contextual.
- Roediger, H. L. & Karpicke, J. D. (2006). [Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention](https://doi.org/10.1111/j.1467-9280.2006.01693.x). El estudio encontró mayor retención demorada tras pruebas de recuperación frente a reestudio repetido, aunque el resultado a muy corto plazo fue distinto.
- Cepeda, N. J. et al. (2006). [Distributed Practice in Verbal Recall Tasks: A Review and Quantitative Synthesis](https://doi.org/10.1037/0033-2909.132.3.354). El metaanálisis indica que el intervalo que favorece la retención depende conjuntamente de la separación y del tiempo hasta la evaluación.
- U.S. Department of Education, What Works Clearinghouse (2007). [Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1). La guía clasifica con evidencia moderada espaciar el aprendizaje, combinar gráficos con descripciones verbales e intercalar ejemplos resueltos y práctica en los contextos cubiertos por la guía.

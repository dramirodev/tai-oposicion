export interface HelpTopic {
  id: string;
  title: string;
  meaning: string;
  example: string;
  chooseInstead: string;
}

export interface HelpSection {
  id: string;
  title: string;
  body: readonly string[];
}

export const FAILURE_HELP: readonly HelpTopic[] = [
  {
    id: 'contenido',
    title: 'Contenido',
    meaning: 'Conocías la materia, pero te faltó un dato o una relación concreta.',
    example: 'Recordabas para qué sirve una norma, pero no su plazo exacto.',
    chooseInstead: 'Elige «No lo sabía» si no reconocías el concepto; «Dudaba entre dos» si ambas opciones te parecían posibles.',
  },
  {
    id: 'trampa',
    title: 'Trampa',
    meaning: 'La pregunta o una opción tenía un matiz que cambió lo que pedía.',
    example: 'La pregunta pedía la opción incorrecta y elegiste una verdadera.',
    chooseInstead: 'Elige «Despiste» si el enunciado era claro y fue una lectura accidental.',
  },
  {
    id: 'duda',
    title: 'Dudaba entre dos',
    meaning: 'Redujiste la elección a dos opciones, pero escogiste la equivocada.',
    example: 'Descartaste dos opciones y no pudiste distinguir las dos restantes.',
    chooseInstead: 'Elige «Contenido» si te faltaba una regla o dato para comparar las opciones.',
  },
  {
    id: 'despiste',
    title: 'Despiste',
    meaning: 'Sabías resolverla, pero marcaste otra respuesta por una equivocación puntual.',
    example: 'Tenías identificada la opción correcta y pulsaste la de al lado.',
    chooseInstead: 'Elige «Velocidad» si sentiste que respondiste demasiado deprisa; no se deduce automáticamente por el tiempo.',
  },
  {
    id: 'no-lo-sabia',
    title: 'No lo sabía',
    meaning: 'No recordabas el contenido necesario para resolver la pregunta.',
    example: 'No reconocías el protocolo ni sus características principales.',
    chooseInstead: 'Elige «Contenido» si sí conocías el tema pero olvidaste un detalle específico.',
  },
  {
    id: 'velocidad',
    title: 'Velocidad',
    meaning: 'La prisa influyó en tu lectura o decisión según tu propia valoración.',
    example: 'Marcaste una opción antes de terminar de leer todas las respuestas.',
    chooseInstead: 'Elige «Despiste» si fue una equivocación puntual sin sensación de prisa. El tiempo por sí solo no determina este motivo.',
  },
];

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: 'acceso', title: 'Acceso y cuenta', body: [
      'Sin acceso completo puedes usar la sesión rápida de cinco minutos. Para abrir tests por tema, simulacros, tarjetas, progreso y entrenamientos, inicia sesión desde Ajustes y solicita acceso; el propietario debe aprobarlo.',
      'Si tienes acceso completo, tu progreso se guarda en este dispositivo. Al iniciar sesión con acceso aprobado también puede sincronizarse con tu cuenta para usarlo en otros dispositivos.',
      'Si eres el propietario, abre «Accesos» en el menú para aprobar o rechazar solicitudes y revocar después un acceso concedido.',
    ],
  },
  {
    id: 'inicio', title: 'Inicio y tipos de práctica', body: [
      'Inicio muestra si tienes una sesión en curso, las preguntas pendientes de repaso, las falladas y un resumen de tu actividad. Pulsa «Continuar sesión» para volver donde estabas.',
      'La sesión rápida incluye 10 preguntas y suele llevar unos cinco minutos; no tiene cronómetro. Con acceso completo también puedes elegir un test por tema, un simulacro, tarjetas o uno de los entrenamientos. «Temas vistos» sirve para marcar lo que ya has repasado.',
      'Abre «Planificación de estudio» desde el menú para ver una sesión preparada, sus pasos ordenados, duración estimada y el motivo de cada recomendación. Los tests, repasos y preguntas se limitan a los temas que has marcado como vistos; en los días de contenido nuevo se propone el siguiente tema del temario sin convertirlo en visto automáticamente. Después de estudiar tus propios apuntes, marca el tema como visto para cerrar ese paso.',
      'La sesión se realiza paso a paso: al comenzar un test, tarjetas o repaso, TAI abre la actividad preparada; al completarla, vuelve a Planificación para continuar. Puedes pausarla manualmente. Si ocultas o cierras la aplicación, el tiempo en curso se pausa y queda guardado el checkpoint del día. El checkpoint se conserva en este dispositivo y se sincroniza con la cuenta cuando hay acceso aprobado y las reglas de Firebase publicadas permiten la escritura. Los días de descanso no acumulan actividades para mañana.',
      'Planificación muestra las cinco sesiones completadas más recientes y conserva hasta 30 en el historial de la cuenta. El tiempo corresponde al que quedó registrado en las actividades; las sesiones incompletas no aparecen en esta lista.',
      'TAI registra el tiempo de la sesión planificada, pero la lectura de apuntes o la reconstrucción mental no se observa directamente; para esas actividades el tiempo depende de que mantengas abierta la sesión. La marca «tema visto» registra cobertura, no comprensión ni fecha de lectura. El repaso activo y las preguntas sirven para comprobar qué recuerdas, pero los umbrales y el reparto de minutos son reglas iniciales del producto, no una fórmula demostrada como óptima.',
    ],
  },
  {
    id: 'sesiones', title: 'Tests y sesiones', body: [
      'En práctica puedes moverte entre preguntas y volver a una anterior. El mapa muestra cuáles están sin visitar, respondidas, pendientes o consultadas. En un simulacro también puedes dejar una pregunta en blanco y marcarla para volver después.',
      'En los tests de práctica, una respuesta registrada queda cerrada durante ese intento. «No lo sé» la deja pendiente sin mostrar la solución: puedes regresar y contestarla más tarde.',
      'Si eliges «Ver solución», la respuesta aparece y esa pregunta queda bloqueada en este intento. Cuenta como blanco consultado, no como acierto ni como fallo.',
    ],
  },
  {
    id: 'puntuacion', title: 'Puntuación y blancos', body: [
      'En el simulacro, cada acierto suma uno y cada fallo resta un tercio; una pregunta en blanco no suma ni resta. La nota se calcula sobre el total de preguntas del modo elegido.',
      'Una pregunta pendiente o cuya solución consultaste cuenta como blanco. Consultar la solución no se guarda como respuesta correcta o incorrecta.',
    ],
  },
  {
    id: 'simulacros', title: 'Simulacros', body: [
      'Puedes elegir un simulacro completo, una prueba por examen o un test de la academia. En el simulacro completo puedes ajustar el número de preguntas, el tiempo, los temas y el origen de las preguntas; también puedes activar la parte del supuesto práctico.',
      'Mientras el simulacro está en marcha no se muestran soluciones. Usa el mapa para ir a otra pregunta o marcarla para revisar. Al terminar verás la corrección y el resultado.',
    ],
  },
  {
    id: 'temario', title: 'Temas estudiados', body: [
      'Marca los temas que ya has estudiado. Esa selección te ayuda a ver tu cobertura y permite limitar los simulacros a tus temas vistos. Marcar un tema no cambia las respuestas ni la puntuación.',
      'Puedes buscar por código o nombre, abrir y cerrar bloques y seleccionar o quitar todos los temas. El mapa de dominio aparece en Progreso cuando hay respuestas registradas.',
    ],
  },
  {
    id: 'repaso', title: 'Preguntas falladas y repaso', body: [
      'Una pregunta fallada permanece en la lista hasta que la aciertes tres veces seguidas. Otro fallo reinicia la racha; dejarla en blanco no cuenta como acierto ni como fallo. Marcar que repasaste su tema no la quita de la lista.',
      'En «Falladas» puedes buscar texto, filtrar por tema, por si has repasado el temario y por racha de aciertos. «Practicar estas» inicia una sesión con las preguntas que quedan en el filtro.',
      'Al marcar «Repasada en el temario» en una pregunta, TAI añade una comprobación de recuerdo dos días después. Si haces un intento antes de esa fecha, la comprobación diferida se conserva; un intento puntuado después de su fecha la completa. Si ya tenía otro vencimiento, se utiliza primero el que llegue antes. La marca no cambia respuestas ni puntuación.',
      '«Repasar hoy» muestra las preguntas que han llegado a su fecha de repaso. El calendario de preguntas se basa en tus respuestas y en las marcas de repaso del temario; el de las tarjetas utiliza la valoración que indicas al revisarlas.',
    ],
  },
  {
    id: 'tarjetas', title: 'Tarjetas de repaso', body: [
      'Primero intenta recordar la respuesta y luego pulsa «Mostrar respuesta». Después indica si fallaste, dudaste o lo sabías. Esa valoración programa cuándo volverá la tarjeta.',
      'Las tarjetas pueden proceder del banco o de una pregunta que marcaste al fallar. En una tarjeta propia puedes quitarla de la sesión si ya no quieres repasarla.',
    ],
  },
  {
    id: 'entrenamientos', title: 'Entrenamientos', body: [
      '«Lectura atenta» practica tres pasos: identificar si piden la opción correcta o la incorrecta, detectar palabras que cambian el sentido y leer todas las opciones antes de elegir.',
      '«Detective de trampas» te pide marcar los matices que encuentres en la pregunta y sus opciones. Al comprobar, verás cuáles detectaste, cuáles faltaron y cuáles marcaste por error.',
      '«Relámpago» presenta una pregunta breve. Puedes responder, pasar a otra o volver a Inicio.',
    ],
  },
  {
    id: 'errores', title: 'Avisar de un error en una pregunta', body: [
      'Si ves un posible error en el banco, pulsa «Avisar de error» al responder. Elige un motivo y, si quieres, escribe una nota breve. El aviso queda guardado en este dispositivo y puede sincronizarse con tu cuenta.',
      'En el menú abre «Errores del banco» —también está en Ajustes— para revisar los avisos, marcarlos como resueltos, reabrirlos, quitarlos o exportarlos en JSON para corregirlos.',
    ],
  },
  {
    id: 'progreso', title: 'Progreso y mapa de dominio', body: [
      'En Progreso puedes consultar tus resultados por tema, el mapa de dominio, la carga de repasos, las preguntas que más tardas en contestar y el historial de sesiones. Puedes abrir una pregunta fallada o iniciar una práctica desde algunas de esas listas.',
      'El mapa combina tu precisión reciente con cuántas preguntas del banco has visto y cuánto tiempo ha pasado desde que practicaste. «Reforzar», «A vigilar» y «Dominado» son orientaciones para organizar el estudio.',
    ],
  },
  {
    id: 'evolucion', title: 'Gráficas de evolución', body: [
      'La evolución semanal de preguntas muestra cuántas viste, acertaste, fallaste y marcaste «No lo sé». La tabla debajo permite consultar los mismos valores por semana.',
      'Esta gráfica usa el historial detallado de sesiones completadas desde que se activó. Las sesiones antiguas no guardan todos esos datos y no se reconstruyen; por eso el gráfico puede tener menos semanas que el historial general.',
    ],
  },
  {
    id: 'explicaciones', title: 'Explicaciones de código', body: [
      'Las explicaciones aparecen después de responder o consultar la solución en práctica, y al terminar un simulacro. Indican si son un borrador o si ya se revisaron, y enlazan las fuentes disponibles.',
      'Las preguntas y explicaciones muestran el código con formato para facilitar su lectura; la app no lo ejecuta. Si una explicación está marcada como borrador, todavía puede necesitar revisión editorial.',
    ],
  },
  {
    id: 'material-visual', title: 'Avisos sobre imágenes o esquemas', body: [
      'Algunas preguntas muestran el aviso «Esquema o imagen pendiente» cuando citan un recurso visual que no está incluido. Puedes leer el resto de la pregunta, pero quizá falte información necesaria para responderla; avisa de un error desde la pregunta si quieres dejar constancia.',
    ],
  },
  {
    id: 'estrategia', title: 'Informe de estrategia', body: [
      'El informe analiza sesiones completadas del historial detallado. No incluye sesiones activas o interrumpidas ni inventa datos para intentos antiguos.',
      'Solo propone una estrategia cuando hay suficientes respuestas y sesiones para compararla. La confianza que marcas es una señal personal, no una probabilidad. Las sugerencias son ideas para probar y comparar, no causas ni diagnósticos.',
    ],
  },
  {
    id: 'ajustes', title: 'Ajustes y accesibilidad', body: [
      'En Ajustes puedes cambiar el tema claro, oscuro o automático, el tamaño de letra y las ayudas de lectura atenta. Estas opciones de apariencia se guardan en el dispositivo.',
      'La fecha objetivo solo sirve para la cuenta atrás: no confirma una convocatoria oficial. Comprueba siempre las fechas en la convocatoria correspondiente.',
      'En iPad puedes usar 1–4 o A–D para responder; Intro, flecha derecha o espacio para avanzar; flecha izquierda para volver; B para dejar en blanco; F para marcar duda; y P para pausar. También puedes deslizar a la izquierda para avanzar y a la derecha para volver.',
    ],
  },
  {
    id: 'offline', title: 'Uso sin conexión', body: [
      'En Ajustes pulsa «Descargar para uso sin conexión» antes de desconectarte. La descarga prepara las preguntas, los supuestos y las tarjetas disponibles en este navegador; la pantalla indica si se completó o qué archivos faltan.',
      'El acceso a la cuenta y la sincronización necesitan conexión. El progreso local sigue guardándose en el dispositivo y se sincroniza cuando vuelva la conexión.',
    ],
  },
  {
    id: 'copias', title: 'Copias, importación y exportación', body: [
      'En Ajustes puedes exportar un archivo JSON de progreso o importar una copia. Antes de importar, la app muestra un resumen; al combinarla conserva los registros actuales que no aparecen en la copia.',
      'También puedes exportar tarjetas a un archivo de texto para Anki. La exportación de análisis para IA prepara archivos en el dispositivo para que decidas si los descargas o compartes; no los envía automáticamente. Pueden contener preguntas y soluciones, así que revisa los archivos antes de compartirlos.',
      'Borrar el historial detallado elimina esos eventos del ámbito actual, pero conserva las estadísticas agregadas, las preguntas falladas, las sesiones históricas y el progreso. Las copias descargadas previamente no se borran.',
    ],
  },
] as const;

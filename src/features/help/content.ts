export interface HelpTopic {
  id: string;
  title: string;
  meaning: string;
  example: string;
  chooseInstead: string;
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

export const HELP_SECTIONS = [
  { id: 'sesiones', title: 'Tests y sesiones', body: 'En práctica puedes revisar preguntas anteriores. Una respuesta registrada no se puede cambiar en ese intento. «No lo sé» deja la pregunta pendiente sin mostrar la solución y puedes volver a responderla. Si eliges «Ver solución», la pregunta queda bloqueada en ese intento y cuenta como blanco consultado.' },
  { id: 'simulacros', title: 'Simulacros', body: 'Durante un simulacro no se muestran soluciones ni explicaciones. Conserva las reglas de navegación y cambio de respuesta del simulacro; la corrección aparece al finalizar.' },
  { id: 'explicaciones', title: 'Explicaciones de código', body: 'Las explicaciones se muestran después de responder o consultar la solución en práctica, y al finalizar un simulacro. Cada una indica si es borrador editorial o revisada, enlaza sus fuentes y no ejecuta el código. Los borradores requieren revisión humana.' },
  { id: 'estrategia', title: 'Analítica de estrategia', body: 'El informe usa el historial detallado que existe desde que se activó el registro; no reconstruye datos antiguos. Excluye sesiones activas e interrumpidas de métricas finales, muestra denominadores y calidad del tiempo, y solo sugiere una estrategia con al menos 20 respuestas en 3 sesiones. La confianza es una señal declarada, no una probabilidad. Las ideas son experimentos para comparar, no causas ni diagnósticos.' },
  { id: 'puntuacion', title: 'Puntuación y blancos', body: 'La nota usa la penalización vigente del modo de examen. Las preguntas pendientes y las consultadas cuentan como blanco; consultar una solución no se guarda como acierto ni como fallo.' },
  { id: 'progreso', title: 'Guardado y sincronización', body: 'El progreso agregado se conserva en este dispositivo y puede sincronizarse al iniciar sesión. Si no hay conexión, vuelve a intentarlo cuando la app esté conectada. La ayuda funciona sin conexión.' },
  { id: 'repaso', title: 'Falladas, repaso y tarjetas', body: 'Las preguntas falladas y sus repasos siguen las reglas actuales de progreso. Un motivo es opcional: elige el que describa tu experiencia, sin inferirlo a partir del tiempo.' },
] as const;

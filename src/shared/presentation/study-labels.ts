export const ERROR_REPORT_REASONS = [
  'Respuesta correcta mal marcada',
  'Enunciado erróneo o confuso',
  'Opciones repetidas o dos correctas',
  'La cita del temario no coincide',
  'Otro',
] as const;

export const FAILURE_REASONS = [
  '',
  'Contenido',
  'Trampa',
  'Dudaba entre dos',
  'Despiste',
  'No lo sabía',
  '',
  'Velocidad',
] as const;

export const READING_TIPS = [
  'Identifica si piden la opción correcta o la incorrecta.',
  'Marca negaciones y excepciones: NO, SALVO, EXCEPTO, INCORRECTA, FALSA.',
  'Subraya cifras, plazos y unidades (días hábiles vs naturales, bits vs bytes).',
  'Desconfía de los absolutos (siempre, nunca, solo, todos): busca la excepción.',
  'Lee las cuatro opciones enteras aunque la primera te parezca buena.',
  'Si «la sabes de golpe», frena: ahí es donde se cuelan los matices.',
  'No cambies de respuesta sin un motivo concreto en el enunciado.',
];

export const UI_THEMES = ['auto', 'light', 'dark'] as const;
export const UI_ZOOMS = [1, 1.15, 1.3, 1.5] as const;

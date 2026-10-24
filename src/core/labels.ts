export const ORIGEN: Record<string, string> = { O: 'Oficial', A: 'Academia', G: 'Generada' };
export const TRAMPAS: Record<string, string> = { 1: 'Cambio de sujeto/órgano', 2: 'Cifra o plazo vecino', 3: 'Alcance del sujeto', 4: 'Pregunta inversa', 5: 'Obligación/facultad', 6: 'Numeración de normas', 7: 'Conceptos casi idénticos', 8: 'Orden invertido', 9: 'Inventado que suena real', 10: 'Trampa del supuesto', 11: 'Contaminación entre normas', 12: 'Absolutización', 13: 'Intruso', 14: 'Cierta pero no responde' };
export const TRAMPA_EXPL: Record<string, string> = {
  1: 'Cambian quién hace algo: el órgano, la autoridad o el sujeto correcto se sustituye por otro parecido.',
  2: 'Cifra, plazo o unidad cercana a la real (10 vs 15 días, hábiles vs naturales). Compara el número con el del temario.',
  3: 'Se amplía o reduce a quién o a qué afecta (todos / solo algunos). Mira el alcance exacto del sujeto.',
  4: 'La pregunta pide la INCORRECTA, la falsa o la excepción. Quien lee deprisa marca la correcta.',
  5: 'Confunden «deberá» con «podrá»: obligación frente a facultad.',
  6: 'Número de ley, artículo o norma cambiado por otro que suena igual. Memoriza la numeración exacta.',
  7: 'Dos conceptos muy parecidos que se intercambian (p. ej. siglas o definiciones casi iguales). Busca el matiz que los distingue.',
  8: 'Los elementos son los correctos pero el orden (fases, niveles, capas) está invertido.',
  9: 'Opción inventada con apariencia técnica verosímil. Si no la reconoces del temario, desconfía.',
  10: 'En el supuesto práctico, un dato del enunciado cambia la respuesta. Relee el caso antes de responder.',
  11: 'Se atribuye a una norma algo que pertenece a otra distinta. Pregúntate de qué norma sale cada dato.',
  12: 'Palabras absolutas (siempre, nunca, solo, todos) que convierten en falsa una afirmación casi cierta.',
  13: 'Una opción no pertenece al grupo que se pide (el «intruso»). Comprueba que cada elemento encaja.',
  14: 'La frase es verdadera, pero no responde a lo que se pregunta. Contrasta cada opción con el enunciado.',
};
export const TIPOS: Record<string, string> = { D: 'Directa', I: 'Inversa', C: 'Completar', K: 'Código/cálculo' };

export const BLOQUES = [['T1', 'Bloque I · Organización del Estado'], ['T2', 'Bloque II · Informática básica'], ['T3', 'Bloque III · Desarrollo'], ['T4', 'Bloque IV · Sistemas y comunicaciones']];

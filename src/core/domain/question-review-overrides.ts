/** Local editorial quarantine for documented risks in the externally authored bank. */
export interface QuestionReviewOverride {
  id: string;
  status: 'quarantined';
  reason: string;
  source: string;
  page?: number;
}

export const questionReviewOverrides: readonly QuestionReviewOverride[] = [
  {
    id: 'GEN-T2.01-66.v2', status: 'quarantined',
    reason: 'La variante generaliza a SMP una cifra de UMA que la fuente no sustenta.',
    source: 'T2.01 Temario.pdf', page: 34,
  },
  {
    id: 'GEN-T2.03-27', status: 'quarantined',
    reason: 'El pasaje usa «clave» para el valor de dispersión y luego afirma que la clave identifica una entrada unívocamente; pendiente de adjudicación técnica.',
    source: 'T2.03 Temario.pdf', page: 15,
  },
  {
    id: 'GEN-T2.03-77.v2', status: 'quarantined',
    reason: 'La formulación de promedio de comparaciones de búsqueda binaria no queda inequívoca frente a máximo/caso peor en la fuente.',
    source: 'T2.03 Temario.pdf', page: 36,
  },
  {
    id: 'GEN-T3.03-63.v2', status: 'quarantined',
    reason: 'El PDF describe la sentencia if y sus bloques, pero no identifica en esta edición el tipo booleano de la condición.',
    source: 'T3.03 Lenguajes de Programación - Temario.pdf', page: 27,
  },
  {
    id: 'GEN-T3.03-41.v2', status: 'quarantined',
    reason: 'La conversión entero a double se presenta como implícita sin que el pasaje citado lo establezca para todos los lenguajes.',
    source: 'T3.03 Temario.pdf', page: 21,
  },
  {
    id: 'GEN-T3.05-93.v2', status: 'quarantined',
    reason: 'Pregunta por la versión «actual» de UML según una edición fechada; requiere fuente de estándar vigente.',
    source: 'T3.05 POO - Temario.pdf', page: 42,
  },
  {
    id: 'GEN-T3.06-420.v2', status: 'quarantined',
    reason: 'La pregunta afirma «moderna», pero la cita del temario solo acredita el concepto sin fecha ni vigencia.',
    source: 'T3.06 Java y .NET - Resumen - Java y .NET subrayado.pdf', page: 86,
  },
  {
    id: 'GEN-T3.06-99.v2', status: 'quarantined',
    reason: 'El PDF respalda la notación tipo? pero no su traducción a System.Nullable<T>; además falta acotar a tipos de valor.',
    source: 'T3.06 Java y .NET - Resumen - C sharp.pdf', page: 6,
  },
  {
    id: 'GEN-T3.07-66', status: 'quarantined',
    reason: 'La pregunta presenta como actual la cobertura de descubrimiento de servicios de OpenShift/Kubernetes según un PDF fechado 2015–2016.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 19,
  },
  {
    id: 'GEN-T3.07-66.v1', status: 'quarantined',
    reason: 'La afirmación de que las plataformas aún no cubren todas las necesidades es temporal y procede de un PDF 2015–2016; no se valida como situación actual.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 19,
  },
  {
    id: 'GEN-T3.07-123.v2', status: 'quarantined',
    reason: 'La pregunta presenta como disponible actualmente una utilidad del W3C citada en el PDF 2015–2016; esa disponibilidad no se puede confirmar con el temario.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 37,
  },
  {
    id: 'GEN-T3.07-182.v2', status: 'quarantined',
    reason: 'El PDF compara REST y SOAP y enumera usos de microservicios, pero no afirma que REST sea la arquitectura preferida para microservicios.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 54,
  },
  {
    id: 'GEN-T3.08-63.v2', status: 'quarantined',
    reason: 'El PDF afirma que un XML bien formado debe comenzar con declaración XML, pero también dice que el prólogo es opcional; la fuente es internamente contradictoria.',
    source: 'T3.08 Aplicaciones Web - Temario.pdf', page: 19,
  },
  {
    id: 'GEN-T3.08-56.v1', status: 'quarantined',
    reason: 'El PDF afirma que XML 1.1 es la última versión, pero el enunciado no ancla la respuesta a la edición/fecha de la fuente y el PDF no permite certificar vigencia posterior.',
    source: 'T3.08 Aplicaciones Web - Temario.pdf', page: 19,
  },
  {
    id: 'GEN-T3.08-69.v2', status: 'quarantined',
    reason: 'El PDF afirma que todo XML Schema tiene prólogo, aunque antes dice que el prólogo de un documento XML es opcional; no se puede resolver la contradicción con esta fuente.',
    source: 'T3.08 Aplicaciones Web - Temario.pdf', page: 22,
  },
  {
    id: 'GEN-T3.08-795.v2', status: 'quarantined',
    reason: 'El PDF usa status == 200 en un ejemplo de éxito, pero no define explícitamente que el código 200 signifique «respuesta correcta»; la opción convierte el ejemplo en una definición no escrita.',
    source: 'T3.08 Aplicaciones Web - Temario - JavaScript.pdf', page: 27,
  },
  {
    id: 'GEN-T3.08-937.v2', status: 'quarantined',
    reason: 'El PDF muestra $array[] = 5 como adición a un array, pero no especifica que se añada «al final»; la clave añade un detalle no explicado por la fuente.',
    source: 'T3.08 Aplicaciones Web - Temario - PHP.pdf', page: 16,
  },
  {
    id: 'GEN-T3.08-950', status: 'quarantined',
    reason: 'El PDF imprime literalmente $array_shift($array), con signo $ delante del nombre; no confirma la función array_shift escrita en el enunciado.',
    source: 'T3.08 Aplicaciones Web - Temario - PHP.pdf', page: 17,
  },
  {
    id: 'GEN-T3.08-950.v1', status: 'quarantined',
    reason: 'El PDF imprime literalmente $array_pop($array), con signo $ delante del nombre; no confirma la función array_pop escrita en el enunciado.',
    source: 'T3.08 Aplicaciones Web - Temario - PHP.pdf', page: 17,
  },
  {
    id: 'GEN-T3.08-1142.v2', status: 'quarantined',
    reason: 'El PDF expande NLTK como «Natural Lenguage ToolKit» (con esa grafía), pero ninguna opción reproduce literalmente la expansión del documento; no corrijo la fuente con conocimiento externo.',
    source: 'T3.08 Aplicaciones Web - Temario - Python.pdf', page: 20,
  },
  {
    id: 'GEN-T3.08-1325.v2', status: 'quarantined',
    reason: 'La variante expande DRY en inglés, pero el PDF desarrolla el concepto como «No te repitas» sin esa expansión literal.',
    source: 'T3.08 Aplicaciones Web - Temario.pdf', page: 12,
  },
  {
    id: 'GEN-T3.07-66.v2', status: 'quarantined',
    reason: 'La pregunta presenta como vigente una capacidad de OpenShift/Kubernetes descrita por la edición 2015–2016; requiere evidencia temporal actual que el temario no aporta.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 19,
  },
  {
    id: 'GEN-T3.07-176', status: 'quarantined',
    reason: 'El PDF solo define WADL como equivalente de WSDL para SOAP; no respalda la afirmación sobre REST ni el formato XML atribuido.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 51,
  },
  {
    id: 'GEN-T3.07-176.v1', status: 'quarantined',
    reason: 'El PDF solo define WADL como equivalente de WSDL para SOAP; no respalda la afirmación sobre REST ni el formato XML atribuido.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 51,
  },
  {
    id: 'GEN-T3.07-176.v2', status: 'quarantined',
    reason: 'El PDF solo define WADL como equivalente de WSDL para SOAP; no respalda la afirmación sobre REST ni el formato XML atribuido.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 51,
  },
  {
    id: 'GEN-T4.08-45.v1', status: 'quarantined',
    reason: 'La expresión «la más utilizada en la actualidad» no está respaldada por la cronología histórica del PDF.',
    source: 'T4.08 Internet - Temario.pdf', page: 46,
  },
  {
    id: 'GEN-T4.02-143', status: 'quarantined',
    reason: 'La clave afirma que la capa de imagen es escribible, pero el PDF indica que es de solo lectura y que la capa de contenedor añade la capa escribible.',
    source: 'T4.02 Sistemas de Almacenamiento - Temario.pdf', page: 82,
  },
];

const quarantinedIds = new Set(questionReviewOverrides.map(item => item.id));

export function isQuestionEditoriallyQuarantined(questionId: string): boolean {
  return quarantinedIds.has(questionId);
}

import type { QuestionRecord } from './question-record.js';

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
    id: 'AS09-P1-48',
    status: 'quarantined',
    reason: 'El enunciado necesita el diagrama de clases UML.',
    source: 'Simulacro 09.pdf',
    page: 9,
  },
  {
    id: 'AS10B-P1-63',
    status: 'quarantined',
    reason: 'El enunciado pide identificar el diagrama que aparece en la figura.',
    source: 'Simulacro 10 (bis).pdf',
    page: 11,
  },
  {
    id: 'AS09-P1-52',
    status: 'quarantined',
    reason: 'El resultado depende del fragmento de código Java que aparece en la imagen.',
    source: 'Simulacro 09.pdf',
    page: 10,
  },
  {
    id: 'AS08B-P1-37',
    status: 'quarantined',
    reason: 'El recorrido en postorden depende del árbol mostrado en el original.',
    source: 'Simulacro 08 (bis).pdf',
    page: 8,
  },
  {
    id: 'AS10B-P1-40',
    status: 'quarantined',
    reason: 'El recorrido en anchura depende del grafo mostrado en el original.',
    source: 'Simulacro 10 (bis).pdf',
    page: 8,
  },
  {
    id: 'AT303-P1-09',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.03 Lenguajes de Programación - Temario.pdf',
    page: 29,
  },
  {
    id: 'AT303-P1-13',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.03 Lenguajes de Programación - Temario.pdf',
    page: 29,
  },
  {
    id: 'AT303-P1-17',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.03 Lenguajes de Programación - Temario.pdf',
    page: 29,
  },
  {
    id: 'AT303-P1-36',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.03 Lenguajes de Programación - Temario.pdf',
    page: 28,
  },
  {
    id: 'GEN-T3.03-47.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.03 Lenguajes de Programación - Temario.pdf',
    page: 20,
  },
  {
    id: 'GEN-T3.03-74.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.03 Lenguajes de Programación - Temario.pdf',
    page: 31,
  },
  {
    id: 'GEN-T3.04-32',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.04 SQL - Temario.pdf',
    page: 13,
  },
  {
    id: 'GEN-T3.04-46.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.04 SQL - Temario.pdf',
    page: 18,
  },
  {
    id: 'GEN-T3.04-51.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.04 SQL - Temario.pdf',
    page: 21,
  },
  {
    id: 'GEN-T3.04-51.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.04 SQL - Temario.pdf',
    page: 21,
  },
  {
    id: 'GEN-T3.08-1101.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.08 Aplicaciones Web - Temario - Python.pdf',
    page: 3,
  },
  {
    id: 'GEN-T3.08-1110.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.08 Aplicaciones Web - Temario - Python.pdf',
    page: 7,
  },
  {
    id: 'GEN-T3.08-1133',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.08 Aplicaciones Web - Temario - Python.pdf',
    page: 16,
  },
  {
    id: 'GEN-T3.08-1140.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.08 Aplicaciones Web - Temario - Python.pdf',
    page: 19,
  },
  {
    id: 'GEN-T3.08-58',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.08 Aplicaciones Web - Temario.pdf',
    page: 19,
  },
  {
    id: 'GEN-T3.08-60.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.08 Aplicaciones Web - Temario.pdf',
    page: 20,
  },
  {
    id: 'GEN-T3.07-170.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf',
    page: 51,
  },
  {
    id: 'AT408-P1-30',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T4.08 Internet - Temario.pdf',
    page: 21,
  },
  {
    id: 'AT408-P1-44',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T4.08 Internet - Temario.pdf',
    page: 33,
  },
  {
    id: 'AT102-P1-46',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T1.02 Cortes Generales - Temario.pdf',
    page: 6,
  },
  {
    id: 'AT102-P1-64',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T1.02 Cortes Generales - Temario.pdf',
    page: 10,
  },
  {
    id: 'AT102-P1-65',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T1.02 Cortes Generales - Temario.pdf',
    page: 5,
  },
  {
    id: 'AT103-P1-41',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T1.03 Gobierno - Temario OPO.pdf',
    page: 14,
  },
  {
    id: 'AT106-P1-31',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T1.01 Constitución Española - Temario.pdf',
    page: 10,
  },
  {
    id: 'GEN-T1.03-52.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T1.03 Gobierno - Temario OPO.pdf',
    page: 22,
  },
  {
    id: 'AT204-P1-22',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.04 Sistemas Operativos - Temario.pdf',
    page: 66,
  },
  {
    id: 'AT204-P1-29',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.04 Sistemas Operativos - Temario.pdf',
    page: 32,
  },
  {
    id: 'AT204-P1-55',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.04 Sistemas Operativos - Temario.pdf',
    page: 11,
  },
  {
    id: 'AT204-P1-41',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.04 Sistemas Operativos - Temario.pdf',
    page: 76,
  },
  {
    id: 'GEN-T2.03-07.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.03 Estructuras de Datos - Temario.pdf',
    page: 6,
  },
  {
    id: 'GEN-T2.03-25.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.03 Estructuras de Datos - Temario.pdf',
    page: 15,
  },
  {
    id: 'GEN-T2.03-62.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.03 Estructuras de Datos - Temario.pdf',
    page: 30,
  },
  {
    id: 'GEN-T2.03-70',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.03 Estructuras de Datos - Temario.pdf',
    page: 33,
  },
  {
    id: 'GEN-T2.04-30.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.04 Sistemas Operativos - Temario.pdf',
    page: 16,
  },
  {
    id: 'GEN-T2.04-117.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.04 Sistemas Operativos - Temario.pdf',
    page: 61,
  },
  {
    id: 'AT201-P1-13',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.01 Informática Básica - Temario.pdf',
    page: 41,
  },
  {
    id: 'AT204-P1-44',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.04 Sistemas Operativos - Temario.pdf',
    page: 23,
  },
  {
    id: 'GEN-T2.03-99.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.03 Estructuras de Datos - Temario.pdf',
    page: 50,
  },
  {
    id: 'GEN-T2.04-75.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T2.04 Sistemas Operativos - Temario.pdf',
    page: 37,
  },
  {
    id: 'GEN-T3.01-05.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.01 Modelo Entidad-Relación - Temario.pdf',
    page: 5,
  },
  {
    id: 'GEN-T3.01-10.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.01 Modelo Entidad-Relación - Temario.pdf',
    page: 6,
  },
  {
    id: 'GEN-T3.01-22.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.01 Modelo Entidad-Relación - Temario.pdf',
    page: 10,
  },
  {
    id: 'GEN-T3.02-20.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.02 Diseño de BD - Temario.pdf',
    page: 13,
  },
  {
    id: 'GEN-T3.02-21.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.02 Diseño de BD - Temario.pdf',
    page: 13,
  },
  {
    id: 'GEN-T3.02-55.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.02 Diseño de BD - Temario.pdf',
    page: 27,
  },
  {
    id: 'GEN-T3.02-66.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T3.02 Diseño de BD - Temario.pdf',
    page: 35,
  },
  {
    id: 'GEN-T3.05-21',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'B3T5_POO 1.pdf',
    page: 43,
  },
  {
    id: 'GEN-T3.05-23.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'B3T5_POO 1.pdf',
    page: 10,
  },
  {
    id: 'GEN-T3.05-45.v2',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'B3T5_POO 1.pdf',
    page: 20,
  },
  {
    id: 'GEN-T4.08-20.v1',
    status: 'quarantined',
    reason:
      'La redacción o clave anterior contiene una incorrección confirmada. Su corrección está revisada y pendiente de publicación verificada.',
    source: 'T4.08 Internet - Temario.pdf',
    page: 14,
  },
];

const reviews = new Map(questionReviewOverrides.map((item) => [item.id, item]));
export const questionReviewOverride = (id: string) => reviews.get(id);

export function isQuestionEditoriallyQuarantined(questionId: string): boolean {
  return reviews.has(questionId);
}

/** Applies the local evidence to static, remote and restored questions without editing the source bank. */
export function applyEditorialScoring(question: QuestionRecord): QuestionRecord {
  return question.np !== 1 && reviews.has(question.i) ? { ...question, np: 1 } : question;
}

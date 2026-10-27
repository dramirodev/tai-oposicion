import type { MappingResult, Question } from '../../../core/domain/entities.js';
import type { QuestionDto } from '../dto/question.js';
import { questionDtoSchema } from '../schemas/question.js';

export interface MappedQuestion {
  question: Question;
  fieldOrder: readonly string[];
  warnings: readonly string[];
}
export type QuestionMappingResult = MappingResult<MappedQuestion>;
type QuestionDtoField = keyof QuestionDto;

const knownFields = new Set<string>([
  'i', 't', 'o', 'q', 'a', 'c', 'k', 'x', 'd', 'n', 'y', 'u', 'np', 'source', 'cp', 's', 'p', 'r', 'v', 'w', 'z', 'f',
]);
const toDtoField: Record<QuestionDtoField, (question: Question) => Partial<QuestionDto>> = {
  i: question => ({ i: question.id }), t: question => ({ t: question.topicId }), o: question => ({ o: question.origin }),
  q: question => ({ q: question.statement }), a: question => ({ a: question.options }), c: question => ({ c: question.correctIndex }),
  k: question => question.kind !== undefined ? { k: question.kind } : {},
  x: question => question.traps !== undefined ? { x: question.traps } : {},
  d: question => question.difficulty !== undefined ? { d: question.difficulty } : {},
  n: question => question.note !== undefined ? { n: question.note } : {},
  y: question => question.year !== undefined ? { y: question.year } : {},
  u: question => question.citation !== undefined ? { u: question.citation } : {},
  np: question => question.nonScoring !== undefined ? { np: question.nonScoring } : {},
  source: question => question.source !== undefined ? { source: question.source } : {},
  cp: question => question.context !== undefined ? { cp: question.context } : {},
  s: question => question.assumptionId !== undefined ? { s: question.assumptionId } : {},
  p: question => question.provisional !== undefined ? { p: question.provisional } : {},
  r: question => question.reserved !== undefined ? { r: question.reserved } : {},
  v: question => question.verificationStatus !== undefined ? { v: question.verificationStatus } : {},
  w: question => question.expiresAfter !== undefined ? { w: question.expiresAfter } : {},
  z: question => question.topicUncertain !== undefined ? { z: question.topicUncertain } : {},
  f: question => question.family !== undefined ? { f: question.family } : {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMappedQuestion(value: MappedQuestion | Question): value is MappedQuestion {
  return 'question' in value && 'fieldOrder' in value;
}

function mapQuestionDescriptors(data: QuestionDto, question: Question): void {
  if (data.k !== undefined) question.kind = data.k;
  if (data.x !== undefined) question.traps = data.x;
  if (data.d !== undefined) question.difficulty = data.d;
  if (data.n !== undefined) question.note = data.n;
  if (data.y !== undefined) question.year = data.y;
  if (data.u !== undefined) question.citation = data.u;
  if (data.np !== undefined) question.nonScoring = data.np;
  if (data.source !== undefined) question.source = data.source;
  if (data.cp !== undefined) question.context = data.cp;
}

function mapQuestionProvenance(data: QuestionDto, question: Question): void {
  if (data.s !== undefined) question.assumptionId = data.s;
  if (data.p !== undefined) question.provisional = data.p;
  if (data.w !== undefined) question.expiresAfter = data.w;
  if (data.v !== undefined) question.verificationStatus = data.v;
  if (data.f !== undefined) question.family = data.f;
  if (data.r !== undefined) question.reserved = data.r;
  if (data.z !== undefined) question.topicUncertain = data.z;
}

export const questionMapper = {
  toDomain(dto: unknown): QuestionMappingResult {
    if (!isRecord(dto)) return { ok: false, reason: 'Pregunta no es un objeto' };
    const parsed = questionDtoSchema.safeParse(dto);
    if (!parsed.success) return { ok: false, reason: 'Pregunta incompleta o inválida' };
    const data = parsed.data;
    if (data.c < 0 || data.c >= data.a.length) return { ok: false, reason: 'Pregunta incompleta o inválida' };

    const question: Question = {
      id: data.i,
      topicId: data.t,
      origin: data.o,
      statement: data.q,
      options: data.a,
      correctIndex: data.c,
    };
    mapQuestionDescriptors(data, question);
    mapQuestionProvenance(data, question);

    return {
      ok: true,
      value: {
        question,
        fieldOrder: Object.keys(dto),
        warnings: Object.keys(dto).filter((field) => !knownFields.has(field)),
      },
    };
  },

  toDto(input: MappedQuestion | Question): QuestionDto {
    const isMapped = isMappedQuestion(input);
    const mapped = isMapped ? input : null;
    const question: Question = isMapped ? input.question : input;
    const fields: QuestionDtoField[] = mapped?.fieldOrder.filter((field): field is QuestionDtoField => knownFields.has(field))
      || ['i', 't', 'o', 'q', 'a', 'c', 'k', 'x', 'd', 'n', 'y', 'u', 'np', 'source', 'cp', 's', 'p', 'r', 'v', 'w', 'z', 'f'];
    const dto: Partial<QuestionDto> = {};
    for (const field of fields) Object.assign(dto, toDtoField[field](question));
    return dto as QuestionDto;
  },
};

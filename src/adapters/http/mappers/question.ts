import type { MappingResult, Question } from '../../../core/domain/entities.js';
import type { QuestionDto } from '../dto/question.js';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validSource(value: unknown): value is NonNullable<QuestionDto['source']> {
  if (!isRecord(value)) return false;
  return typeof value.url === 'string'
    && (value.title === undefined || typeof value.title === 'string')
    && (value.page === undefined || typeof value.page === 'number')
    && typeof value.verified === 'boolean';
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function validOptionalFields(dto: Record<string, unknown>): boolean {
  return (dto.k === undefined || typeof dto.k === 'string')
    && (dto.x === undefined || (Array.isArray(dto.x) && dto.x.every((value) => typeof value === 'number')))
    && (dto.d === undefined || dto.d === null || typeof dto.d === 'number')
    && (dto.n === undefined || typeof dto.n === 'string')
    && (dto.y === undefined || typeof dto.y === 'string')
    && (dto.u === undefined || typeof dto.u === 'string')
    && (dto.np === undefined || typeof dto.np === 'number')
    && (dto.source === undefined || validSource(dto.source))
    && (dto.cp === undefined || typeof dto.cp === 'string')
    && (dto.s === undefined || typeof dto.s === 'string')
    && (dto.p === undefined || typeof dto.p === 'number')
    && (dto.r === undefined || typeof dto.r === 'number')
    && (dto.v === undefined || typeof dto.v === 'number')
    && (dto.w === undefined || typeof dto.w === 'number')
    && (dto.z === undefined || typeof dto.z === 'number')
    && (dto.f === undefined || typeof dto.f === 'string');
}

function isMappedQuestion(value: MappedQuestion | Question): value is MappedQuestion {
  return 'question' in value && 'fieldOrder' in value;
}

export const questionMapper = {
  toDomain(dto: unknown): QuestionMappingResult {
    // TODO(zod): validate QuestionDto before mapping.
    if (!isRecord(dto)) return { ok: false, reason: 'Pregunta no es un objeto' };
    if (
      typeof dto.i !== 'string' || typeof dto.t !== 'string'
      || (dto.o !== 'O' && dto.o !== 'A' && dto.o !== 'G')
      || typeof dto.q !== 'string'
      || !Array.isArray(dto.a) || !dto.a.every((option) => typeof option === 'string')
      || !isInteger(dto.c) || dto.c < 0 || dto.c >= dto.a.length || !validOptionalFields(dto)
    ) return { ok: false, reason: 'Pregunta incompleta o inválida' };

    const question: Question = {
      id: dto.i,
      topicId: dto.t,
      origin: dto.o,
      statement: dto.q,
      options: dto.a,
      correctIndex: dto.c,
    };
    if (typeof dto.k === 'string') question.kind = dto.k;
    if (Array.isArray(dto.x)) question.traps = dto.x;
    if (dto.d === null || typeof dto.d === 'number') question.difficulty = dto.d;
    if (typeof dto.n === 'string') question.note = dto.n;
    if (typeof dto.y === 'string') question.year = dto.y;
    if (typeof dto.u === 'string') question.citation = dto.u;
    if (typeof dto.np === 'number') question.nonScoring = dto.np;
    if (dto.source !== undefined && validSource(dto.source)) question.source = dto.source;
    if (typeof dto.cp === 'string') question.context = dto.cp;
    if (typeof dto.s === 'string') question.assumptionId = dto.s;
    if (typeof dto.p === 'number') question.provisional = dto.p;
    if (typeof dto.w === 'number') question.expiresAfter = dto.w;
    if (typeof dto.v === 'number') question.verificationStatus = dto.v;
    if (typeof dto.f === 'string') question.family = dto.f;
    if (typeof dto.r === 'number') question.reserved = dto.r;
    if (typeof dto.z === 'number') question.topicUncertain = dto.z;

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
    for (const field of fields) {
      switch (field) {
        case 'i': dto.i = question.id; break;
        case 't': dto.t = question.topicId; break;
        case 'o': dto.o = question.origin; break;
        case 'q': dto.q = question.statement; break;
        case 'a': dto.a = question.options; break;
        case 'c': dto.c = question.correctIndex; break;
        case 'k': if (question.kind !== undefined) dto.k = question.kind; break;
        case 'x': if (question.traps !== undefined) dto.x = question.traps; break;
        case 'd': if (question.difficulty !== undefined) dto.d = question.difficulty; break;
        case 'n': if (question.note !== undefined) dto.n = question.note; break;
        case 'y': if (question.year !== undefined) dto.y = question.year; break;
        case 'u': if (question.citation !== undefined) dto.u = question.citation; break;
        case 'np': if (question.nonScoring !== undefined) dto.np = question.nonScoring; break;
        case 'source': if (question.source !== undefined) dto.source = question.source; break;
        case 'cp': if (question.context !== undefined) dto.cp = question.context; break;
        case 's': if (question.assumptionId !== undefined) dto.s = question.assumptionId; break;
        case 'p': if (question.provisional !== undefined) dto.p = question.provisional; break;
        case 'r': if (question.reserved !== undefined) dto.r = question.reserved; break;
        case 'v': if (question.verificationStatus !== undefined) dto.v = question.verificationStatus; break;
        case 'w': if (question.expiresAfter !== undefined) dto.w = question.expiresAfter; break;
        case 'z': if (question.topicUncertain !== undefined) dto.z = question.topicUncertain; break;
        case 'f': if (question.family !== undefined) dto.f = question.family; break;
      }
    }
    return dto as QuestionDto;
  },
};

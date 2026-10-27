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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMappedQuestion(value: MappedQuestion | Question): value is MappedQuestion {
  return 'question' in value && 'fieldOrder' in value;
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
    if (data.k !== undefined) question.kind = data.k;
    if (data.x !== undefined) question.traps = data.x;
    if (data.d !== undefined) question.difficulty = data.d;
    if (data.n !== undefined) question.note = data.n;
    if (data.y !== undefined) question.year = data.y;
    if (data.u !== undefined) question.citation = data.u;
    if (data.np !== undefined) question.nonScoring = data.np;
    if (data.source !== undefined) question.source = data.source;
    if (data.cp !== undefined) question.context = data.cp;
    if (data.s !== undefined) question.assumptionId = data.s;
    if (data.p !== undefined) question.provisional = data.p;
    if (data.w !== undefined) question.expiresAfter = data.w;
    if (data.v !== undefined) question.verificationStatus = data.v;
    if (data.f !== undefined) question.family = data.f;
    if (data.r !== undefined) question.reserved = data.r;
    if (data.z !== undefined) question.topicUncertain = data.z;

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

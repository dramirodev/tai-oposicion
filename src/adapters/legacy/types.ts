// Tipos compartidos de datos. Los registros viajan como tuplas/arrays porque se guardan así en localStorage y Firestore.
import type { QuestionRecord } from '../../core/domain/question-record.js';
export type { AppState, CardMap, CardRec, Cfg, Report, ReportMap, ReportState, Res, SeenDoc, Session, SessionKind, StatMap, StatRec } from '../local/dto/stored-progress.js';


/** Origen de la pregunta: O oficial, A academia, G generada. */
export type Origin = 'O' | 'A' | 'G';
export type Question = QuestionRecord;

/** Entrada de meta.json: [tema, ...datos auxiliares]. */
export type MetaEntry = [string, Origin, string, (number | string)[], number];
export type Meta = Record<string, MetaEntry> & { _by: Record<string, string[]> };
export interface TemaInfo { id: string; nombre: string; n: number }
export interface Index { n: number; nsup: number; temas: TemaInfo[] }

export type AccessLevel = 'invitado' | 'pendiente' | 'aprobado' | 'propietario';
export interface AccessRequest { uid: string; email: string; name?: string; ts?: number }

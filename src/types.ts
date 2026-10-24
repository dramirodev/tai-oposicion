// Tipos compartidos de datos. Los registros viajan como tuplas/arrays porque se guardan así en localStorage y Firestore.

/** Resultado de una respuesta: 1 acierto, 0 fallo, 2 en blanco. */
export type Res = 0 | 1 | 2;

/**
 * Registro por pregunta: [n, ok, last, box, due, lastRes, flag, secs, nsecs, motivo, racha?, repasada?, fechaRepasada?]
 * n=intentos, ok=aciertos, last=ms de la última actividad, box=-1 fuera del repaso (0..3 en repaso),
 * due=ms del próximo repaso, lastRes=Res, flag=1 dudosa, secs/nsecs=tiempo acumulado, motivo=1..8,
 * [10]=racha tras fallo, [11]=temario repasado (0/1), [12]=fecha de cambio de esa marca.
 */
export type StatRec = number[];
export type StatMap = Record<string, StatRec>;

/** Tarjeta: [n, ok, last, box, due, lastGrade]; lastGrade -1 = borrada (marca sincronizada). */
export type CardRec = number[];
export type CardMap = Record<string, CardRec>;

export type SessionKind = 'sim' | 'rev' | 'test';
export interface Session {
  interrupted?: boolean; porTiempo?: boolean;
  id: string; ts: number; kind: SessionKind; n: number; a: number; f: number; b: number; secs: number; nota: number;
  temas: Record<string, [number, number]>; tipos: Record<string, [number, number]>; fails: string[]; titulo: string;
}

export type ReportState = 'abierto' | 'resuelto' | 'quitado';
export interface Report { ts: number; tema: string; motivo: string; nota: string; st: ReportState }
export type ReportMap = Record<string, Report>;

export interface SeenDoc { t: string[]; ts: number }

/** Preferencias guardadas (cada clave tiene su esquema en config.ts). */
export type Cfg = Record<string, any>;

export interface AppState {
  stats: StatMap; sessions: Session[]; cfg: Cfg; seen: SeenDoc; reports: ReportMap; cards: CardMap;
}

/** Origen de la pregunta: O oficial, A academia, G generada. */
export type Origin = 'O' | 'A' | 'G';
export interface Question {
  i: string; t: string; o: Origin; q: string; a: string[]; c: number;
  k?: string; x?: number[]; d?: number; n?: string; y?: string; u?: string; np?: number;
  /** Contexto previo, supuesto (s), provisional (p), puede caducar (w), variante (v). */
  source?: { url: string; title?: string; page?: number; verified: boolean };
  cp?: string; supTexto?: string; s?: unknown; p?: unknown; w?: unknown; v?: unknown;
}

/** Entrada de meta.json: [tema, ...datos auxiliares]. */
export type MetaEntry = [string, ...any[]];
export interface Meta { [id: string]: any; _by: Record<string, string[]> }
export interface TemaInfo { id: string; nombre: string; n: number }
export interface Index { n: number; nsup: number; temas: TemaInfo[] }

export type AccessLevel = 'invitado' | 'pendiente' | 'aprobado' | 'propietario';
export interface AccessRequest { uid: string; email: string; name?: string; ts?: number }

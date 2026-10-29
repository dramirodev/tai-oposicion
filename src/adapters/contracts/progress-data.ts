import type { Preferences } from '../../core/domain/entities.js';

/** Persisted and synchronized answer value: 1 correct, 0 wrong, 2 blank. */
export type Res = 0 | 1 | 2;

/** Stable persisted and synchronized question-statistics tuple. */
export type StatRec = number[];
export type StatMap = Record<string, StatRec>;

/** Stable persisted and synchronized card tuple with optional versioned FSRS state. */
export type CardRec = number[];
export type CardMap = Record<string, CardRec>;

export type SessionKind = 'sim' | 'rev' | 'test';
export interface Session {
  interrupted?: boolean;
  porTiempo?: boolean;
  id: string;
  ts: number;
  kind: SessionKind;
  n: number;
  a: number;
  f: number;
  b: number;
  secs: number;
  nota: number;
  temas: Record<string, [number, number]>;
  tipos: Record<string, [number, number]>;
  fails: string[];
  titulo: string;
}

export type ReportState = 'abierto' | 'resuelto' | 'quitado';
export interface Report { ts: number; tema: string; motivo: string; nota: string; st: ReportState }
export type ReportMap = Record<string, Report>;

export interface SeenDoc { t: string[]; ts: number }
export type Cfg = Preferences;

export interface AppState {
  stats: StatMap;
  sessions: Session[];
  cfg: Cfg;
  seen: SeenDoc;
  reports: ReportMap;
  cards: CardMap;
}

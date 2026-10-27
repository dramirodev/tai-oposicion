import type { SessionKind } from '../domain/entities.js';
import type { Confidence, Highlight } from '../domain/attempts/transitions.js';
import type { QuestionRecord } from '../domain/question-record.js';

export interface RunCfg {
  kind: SessionKind;
  feedback: boolean;
  items: QuestionRecord[];
  titulo?: string;
  limit?: number;
  porTiempo?: boolean;
  supTexto?: string;
}

export interface Run extends RunCfg {
  sessionKey: number;
  idx: number;
  ans: (number | undefined)[];
  times?: (number | undefined)[];
  t0: number;
  secs: number;
  paused: boolean;
  studyStates?: ('unseen' | 'pending' | 'answered' | 'revealed')[];
  confidences?: Confidence[];
  discardedOptions?: number[][];
  highlights?: Highlight[][];
  since?: number | null;
  base?: number;
  tIdx?: number;
  q0?: number;
  qT0?: number;
  gt?: ReturnType<typeof setInterval>;
  review?: number[];
  luck?: Record<number, number>;
  fast?: Record<number, [number, number]>;
  attemptScope?: string;
  attemptSessionId?: string;
  attemptIds?: string[];
  attemptTrackingPaused?: boolean;
}

export interface CompletedStudyRun {
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

export interface LastResult {
  ses: CompletedStudyRun;
  items: QuestionRecord[];
  ans: (number | undefined)[];
  times: (number | undefined)[];
  limit: number;
  studyStates?: ('unseen' | 'pending' | 'answered' | 'revealed')[];
  confidences?: Confidence[];
  discardedOptions?: number[][];
  highlights?: Highlight[][];
}

export interface EngineSnapshot {
  readonly run: Readonly<Run> | null;
  readonly last: Readonly<LastResult> | null;
}

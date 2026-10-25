export type StatRecordDto = number[];
export type CardRecordDto = number[];
export interface SessionDto { id: string; ts: number; kind: 'sim'|'rev'|'test'; n: number; a: number; f: number; b: number; secs: number; nota: number; temas: Record<string,[number,number]>; tipos: Record<string,[number,number]>; fails: string[]; titulo: string; interrupted?: boolean; porTiempo?: boolean }
export interface ReportDto { ts: number; tema: string; motivo: string; nota: string; st: 'abierto'|'resuelto'|'quitado' }
export interface ProgressDto { stats: Record<string,StatRecordDto>; sessions: SessionDto[]; cfg: Record<string,unknown>; seen: {t:string[];ts:number}; reports: Record<string,ReportDto>; cards: Record<string,CardRecordDto> }

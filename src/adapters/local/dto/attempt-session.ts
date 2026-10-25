export interface AttemptSessionDto {
  schemaVersion: 1;
  id: string;
  sourceSessionId?: string;
  mode: 'practice' | 'simulation';
  status: 'active' | 'completed' | 'interrupted';
  startedAt: number;
  endedAt?: number;
  lastSequence: number;
}

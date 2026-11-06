export interface AttemptSessionDto {
  schemaVersion: 1;
  id: string;
  sourceSessionId?: string;
  activity?: 'questions' | 'attentive-reading';
  mode: 'practice' | 'simulation';
  status: 'active' | 'completed' | 'interrupted';
  startedAt: number;
  timeLimitSeconds?: number;
  elapsedSeconds?: number;
  endedAt?: number;
  lastSequence: number;
}

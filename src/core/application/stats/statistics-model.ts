export interface TopicProgress {
  id: string;
  name: string;
  interactions: number;
  correct: number;
  seen: number;
  total: number;
  accuracy: number;
}

export interface StatsDomainTopic {
  id: string;
  name: string;
  accuracy: number;
  days: number | null;
  status: 'r' | 'y' | 'g' | 'n';
  reason: string;
  due: number;
  score: number;
}

export interface StatsSnapshot {
  generatedAt: number;
  answers: number;
  correct: number;
  accuracy: number;
  failureCount: number;
  weakTopics: readonly TopicProgress[];
  topics: readonly TopicProgress[];
  sessions: readonly { id: string; ts: number; kind: string; n: number; a: number; nota: number; secs: number }[];
  reviewLoad: readonly number[];
  failureReasons: readonly number[];
  lucky: number;
  speed: { count: number; total: number; percent: number };
  trapRates: readonly { id: string; label: string; attempts: number; failures: number; rate: number }[];
  origins: readonly { label: string; answers: number; accuracy: number }[];
  types: readonly { id: string; label: string; answers: number; accuracy: number }[];
  domains: readonly StatsDomainTopic[];
  simulations: readonly { id: string; ts: number; nota: number; part: string; dNota: number | null; a: number; f: number; b: number; secs: number }[];
  slow: readonly { id: string; averageSeconds: number; attempts: number; correct: number; lastOutcome: number | null }[];
}

export interface StatsComparison {
  scoreDelta: number | null;
  accuracyDelta: number | null;
  secondsDelta: number | null;
  topics: readonly { id: string; first: number | null; second: number | null; delta: number | null }[];
}

export interface StatsWeek {
  start: number;
  n: number;
  ok: number;
  secs: number;
  sessions: number;
  accuracy: number | null;
  secondsPerQuestion: number | null;
}

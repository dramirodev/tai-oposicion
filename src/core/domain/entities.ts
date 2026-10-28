export type MappingResult<T> = { ok: true; value: T } | { ok: false; reason: string };
export type Origin = 'O' | 'A' | 'G';
export type AnswerResult = 0 | 1 | 2;
export type SessionKind = 'sim'|'rev'|'test';
export type AccessLevel = 'invitado' | 'pendiente' | 'aprobado' | 'propietario';
export type ReportState = 'abierto' | 'resuelto' | 'quitado';
export interface QuestionSource { url: string; title?: string; page?: number; verified: boolean }
export interface Question { id: string; topicId: string; origin: Origin; statement: string; options: string[]; correctIndex: number; kind?: string; traps?: number[]; difficulty?: number|null; note?: string; year?: string; citation?: string; nonScoring?: number; source?: QuestionSource; context?: string; assumptionId?: string; provisional?: number; expiresAfter?: number; verificationStatus?: number; family?: string; reserved?: number; topicUncertain?: number }
export interface QuestionStats { attempts: number; correct: number; lastSeenAt: number; intervalStep?: number; dueAt?: number; lastResult?: AnswerResult; doubtful?: boolean; secondsStudied?: number; timedAnswers?: number; errorReason?: number; failureStreak?: number; syllabusReviewed?: boolean; syllabusReviewedAt?: number }
export interface SessionResult { id: string; completedAt: number; kind: SessionKind; questionCount: number; correctCount: number; wrongCount: number; blankCount: number; durationSeconds: number; score: number; topicResults: Record<string, [number, number]>; typeResults: Record<string, [number, number]>; failedQuestionIds: string[]; title: string; interrupted?: boolean; timeLimited?: boolean }
export interface Session { id: string; kind: SessionKind; questionIds: string[]; answers: Record<string, number | null>; currentIndex: number; startedAt: number; title: string }
export interface FsrsCardState {
  schemaVersion: 1;
  algorithmVersion: 6;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  lastReviewAt: number | null;
}
export interface CardReview { attempts: number; known: number; lastReviewedAt: number; intervalStep: number; dueAt: number; lastGrade?: number; fsrs?: FsrsCardState }
export interface CardsSessionCheckpoint { ids: string[]; index: number; revealed: boolean; results: [number, number, number] }
export interface Flashcard { id: string; front: string; back: string }
export interface Trap { id: string; questionId: string; explanation?: string }
export interface ErrorReport { questionId: string; reportedAt: number; topicId: string; reason: string; note: string; state: ReportState }
export interface AccessRequest { uid: string; email: string; name?: string; requestedAt?: number }
export interface ExamConfig { examDate?: string; durationMinutes?: number; questionCount?: number; [setting: string]: string|number|boolean|null|undefined }
export interface Topic { id: string; name: string }
export interface Preferences {
  exam?: string;
  training?: TrainingPreferences;
  ui?: { theme?: 'auto' | 'light' | 'dark'; size?: number; lectura?: number };
  test?: { all?: boolean; sel?: string[]; n?: number; mode?: 'nuevas' | 'aleatorio' | 'falladas' | 'dudosas' | 'trampas'; o?: Origin[]; pt?: number; min?: number };
  sim?: { n?: number; min?: number; o?: Origin[]; parte2?: boolean; scope?: 'vistos' | 'todos' };
  cardsc?: { n?: number; scope?: 'vistos' | 'todos' };
  evo?: { m?: 'acierto' | 'tiempo'; f?: string; w?: number; tabla?: boolean };
  simc?: { a?: number; b?: number };
  slow?: { ok?: boolean };
  simtab?: string;
  exsel?: string;
  errf?: string;
  dmord?: string;
  tdet?: Record<string, number[]>;
  [key: string]: unknown;
}
export type TrainingActivity = 'activeRecall' | 'topicTest' | 'failures' | 'spacedReviews';
export type StudyReviewMode = 'initial-study' | 'active-retrieval' | 'selective-reading' | 'broad-reading';
export interface TrainingPreferences {
  /** Sunday-first local calendar: Sunday, Monday, ..., Saturday. */
  minutesByDay: [number, number, number, number, number, number, number];
  introductionDay: number;
  activities: TrainingActivity[];
  /** User choices are retained per topic and take precedence over automatic guidance. */
  reviewModesByTopic?: Record<string, StudyReviewMode>;
}
export interface UserProgress { statistics: Record<string, QuestionStats>; sessions: SessionResult[]; preferences: Preferences; seenTopics: string[]; seenAt: number; reports: Record<string, ErrorReport>; cardReviews: Record<string, CardReview> }

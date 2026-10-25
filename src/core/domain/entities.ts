export type MappingResult<T> = { ok: true; value: T } | { ok: false; reason: string };
export type Origin = 'O' | 'A' | 'G';
export type AnswerResult = 0 | 1 | 2;
export type AccessLevel = 'invitado' | 'pendiente' | 'aprobado' | 'propietario';
export type ReportState = 'abierto' | 'resuelto' | 'quitado';
export interface QuestionSource { url: string; title?: string; page?: number; verified: boolean }
export interface Question { id: string; topicId: string; origin: Origin; statement: string; options: string[]; correctIndex: number; kind?: string; traps?: number[]; difficulty?: number; note?: string; year?: string; citation?: string; nonScoring?: number; source?: QuestionSource; context?: string; assumptionText?: string; assumptionId?: unknown; provisional?: unknown; expiresAfter?: unknown; verificationStatus?: unknown; family?: unknown; reserved?: unknown; topicUncertain?: unknown; [key: string]: unknown }
export interface QuestionStats { attempts: number; correct: number; lastSeenAt: number; intervalStep?: number; dueAt?: number; lastResult?: AnswerResult; doubtful?: boolean; secondsStudied?: number; timedAnswers?: number; errorReason?: number; failureStreak?: number; syllabusReviewed?: boolean; syllabusReviewedAt?: number }
export interface SessionResult { id: string; completedAt: number; kind: string; questionCount: number; correctCount: number; wrongCount: number; blankCount: number; durationSeconds: number; score: number; topicResults: Record<string, [number, number]>; typeResults: Record<string, [number, number]>; failedQuestionIds: string[]; title: string; interrupted?: boolean; timeLimited?: boolean }
export interface Session extends SessionResult {}
export interface CardReview { attempts: number; known: number; lastReviewedAt: number; intervalStep: number; dueAt: number; lastGrade?: number }
export interface Flashcard { id: string; front: string; back: string }
export interface ErrorReport { questionId: string; reportedAt: number; topicId: string; reason: string; note: string; state: ReportState }
export interface AccessRequest { uid: string; email: string; name?: string; requestedAt?: number }
export interface ExamConfig { [key: string]: unknown }
export interface Topic { id: string; name: string }
export interface UserProgress { statistics: Record<string, QuestionStats>; sessions: SessionResult[]; preferences: Record<string, unknown>; seenTopics: string[]; seenAt: number; reports: Record<string, ErrorReport>; cardReviews: Record<string, CardReview> }

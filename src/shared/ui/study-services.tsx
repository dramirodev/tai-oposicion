import { createContext, useContext } from 'react';
import type { StatsComparison, StatsSnapshot, StatsWeek, TopicProgress } from '../../core/application/stats/statistics-model.js';
import type { StudyReviewMode, TrainingActivity, TrainingPreferences } from '../../core/domain/entities.js';
import type { DailyTrainingPlan } from '../../core/domain/study-training-plan.js';
import type { DailyTrainingSession } from '../../core/domain/study-training-session.js';
import type { ObservedStudyTime } from '../../core/domain/attempts/observed-study-time.js';
export type { StatsComparison, StatsDomainTopic, StatsSnapshot, StatsWeek, TopicProgress } from '../../core/application/stats/statistics-model.js';
export interface ActiveStudy { title: string; position: number; total: number }
export interface HomeBlock { name: string; total: number; mastered: number; assessed: number }
export interface HomeOverview {
  completedSessions: number; blocks: HomeBlock[];
  seen: number; total: number; answers: number; streak: number; daysToExam: number | null;
  due: number; cardsDue: number; quickCount: number; slowCount: number; failures: number;
  studiedTopics: number; topicCount: number; assessedTopics: number; weakTopics: number; masteredTopics: number;
  trainingPlan: DailyTrainingPlan; trainingSession: DailyTrainingSession | null;
}
export interface AccessOverview {
  full: boolean; level: string; greeting: string; state: string; configured: boolean;
  signedIn: boolean; pendingRequests: number;
}
export interface HomeServices {
  loadOverview(): Promise<HomeOverview>;
  accountId(): string | null;
  authResolved(): boolean;
  getAccess(): AccessOverview;
  getActiveStudy(): ActiveStudy | null;
  subscribe(listener: () => void): () => void;
  quickSession(): Promise<void>;
  startReview(): Promise<void>;
  startTrainingSession(plan: DailyTrainingPlan): DailyTrainingSession | null;
  startTrainingActivity(): DailyTrainingSession | null;
  completeTrainingActivity(activity: TrainingActivity): DailyTrainingSession | null;
  setTrainingReviewMode(topicId: string, mode: StudyReviewMode | null): void;
  openMenu(): void;
  login(): Promise<unknown>;
  requestAccess(): Promise<boolean>;
  notify(message: string): void;
}
export interface TopicOverview { id: string; name: string; total: number; answered: number; accuracy: number | null }
export interface TopicServices {
  loadTopics(): Promise<TopicOverview[]>;
  getStudied(): readonly string[];
  setStudied(ids: readonly string[]): void;
  accountId(): string | null;
  subscribe(listener: () => void): () => void;
}
export interface StudyCard {
  id: string; t: string; q: string; a: string; nota?: string; ref?: string; tipo?: string; src?: string;
  np?: number; source?: { url: string; title?: string; page?: number; verified: boolean }; supTexto?: string; cp?: string; caduca?: boolean;
}
export interface CardPreferences { scope: 'vistos' | 'todos'; count: 10 | 20 | 30 }
export interface CardsPlan {
  cards: StudyCard[];
  summary: { nuevas: number; enRepaso: number; dominadas: number; hoy: number };
  ids: string[];
  reviews: number;
}
export interface ActiveCardsSession {
  account: string | null; items: StudyCard[]; index: number; revealed: boolean; results: [number, number, number];
}
export interface CardsServices {
  loadPlan(preferences: CardPreferences): Promise<CardsPlan>;
  loadAllCards(): Promise<StudyCard[]>;
  loadCuratedCards(): Promise<StudyCard[]>;
  getPreferences(): CardPreferences;
  savePreferences(preferences: CardPreferences): void;
  getSession(): ActiveCardsSession | null;
  startSession(cards: readonly StudyCard[], ids: readonly string[]): ActiveCardsSession;
  reveal(): boolean;
  grade(value: number): ActiveCardsSession | null;
  removeFailureCard(): ActiveCardsSession | null;
  clearSession(): void;
  nextDueDates(): number[];
  reviewLabel(cardId: string, grade: number): string;
  topicName(topicId: string): string;
  getReport(cardId: string): { motivo: string; nota: string; st: string } | undefined;
  saveReport(card: Pick<StudyCard, 'id' | 't'>, reason: string, note: string): void;
}
export interface AccessMember { uid: string; email: string; name?: string; ts?: number }
export interface AccessManagementServices {
  accountId(): string | null;
  subscribe(listener: () => void): () => void;
  load(): Promise<{ owner: boolean; error?: string; requests: readonly AccessMember[]; grants: readonly AccessMember[] }>;
  approve(member: AccessMember): Promise<boolean>;
  reject(uid: string): Promise<boolean>;
  revoke(uid: string): Promise<boolean>;
  confirm(message: string, label: string, danger: boolean): Promise<boolean>;
  notify(message: string): void;
}
export interface ErrorReportRecord { id: string; ts: number; tema: string; motivo: string; nota: string; state: 'abierto' | 'resuelto' | 'quitado' }
export interface ReportedOption { label: string; text: string; correct: boolean }
export interface ReportedQuestion { id: string; origin?: string; statement: string; options: readonly ReportedOption[]; reference?: string | null; traps: readonly string[] }
export interface ReportedCard { id: string; question: string; answer: string; reference?: string | null }
export interface ErrorReportContent { questions: readonly ReportedQuestion[]; cards: readonly ReportedCard[] }
export interface ErrorServices {
  getFilter(): string;
  getReports(): readonly ErrorReportRecord[];
  subscribe(listener: () => void): () => void;
  setFilter(filter: string): void;
  loadContent(ids: readonly string[]): Promise<ErrorReportContent>;
  setState(id: string, state: ErrorReportRecord['state']): void;
  exportData(): Promise<string>;
}
export interface FailureQuestion { id: string; topicId: string; statement: string; options: readonly string[]; correctIndex: number; citation?: string; note?: string; year?: string; context?: string; assumptionText?: string; traps?: readonly number[]; nonScoring?: number; source?: { url: string; title?: string; page?: number; verified: boolean }; progress?: { attempts: number; correct: number; lastSeenAt: number; failureStreak: number; syllabusReviewed: boolean } }
export interface FailureServices {
  loadQuestions(): Promise<FailureQuestion[]>;
  loadTopics(): Promise<readonly { id: string; name: string }[]>;
  setReviewed(id: string, topicId: string, reviewed: boolean): void;
  topicName(id: string): string;
  startPractice(ids: readonly string[], title: string): void;
}
export type LightningReasonKind = 'lucky' | 'due' | 'failed' | 'new';
export interface LightningQuestion extends FailureQuestion { reason: string; reasonKind: LightningReasonKind }
export interface LightningServices { loadQuestion(): Promise<LightningQuestion | null>; record(questionId: string, topicId: string, correct: boolean, seconds: number): void; topicName(id: string): string }
export interface TrapPrompt extends FailureQuestion { topicName: string; trapIds: readonly number[]; choices: readonly number[] }
export interface TrapAnswer { hits: number; missed: number; falseAlarms: number; total: number; correctIds: readonly number[]; selectedIds: readonly number[] }
export interface TrapWeakness { id: number; seen: number; detected: number }
export interface TrapRun { items: readonly TrapPrompt[]; index: number; results: readonly TrapAnswer[] }
export interface TrapsServices { getRun(): TrapRun | null; startRun(): Promise<TrapRun>; evaluate(selected: readonly number[]): TrapAnswer | null; next(): TrapRun | null; getWeaknesses(): TrapWeakness[]; resetRun(): void }
export interface ReadingToken { text: string; key: boolean; start: number }
export interface ReadingPrompt extends FailureQuestion { asksForNegative: boolean; minimumSeconds: number; tokens: readonly ReadingToken[] }
export interface ReadingWordResult { hit: number; missed: number; extra: number; total: number; claimedNone: boolean }
export interface ReadingOutcome { correct: boolean; meaningCorrect: boolean; marked: [number, number] }
export interface ReadingProgress { items: readonly ReadingPrompt[]; index: number; step: 0 | 1 | 2; meaningChoice: 0 | 1 | null; meaningCorrect: boolean | null; selectedWords: readonly number[]; wordResult: ReadingWordResult | null; selectedAnswer: number | null; answerCorrect: boolean | null; startedAt: number; outcomes: readonly ReadingOutcome[]; complete: boolean }
export interface ReadingServices {
  getProgress(): ReadingProgress | null;
  subscribe(listener: () => void): () => void;
  start(): Promise<ReadingProgress | null>;
  answerMeaning(choice: 0 | 1): void;
  continueMeaning(): void;
  toggleWord(index: number): void;
  checkWords(claimedNone?: boolean): ReadingWordResult | null;
  showOptions(): void;
  answerOption(index: number): boolean | null;
  next(): ReadingProgress | null;
  reset(): void;
}
export type TestMode = 'nuevas' | 'aleatorio' | 'falladas' | 'dudosas' | 'trampas';
export interface TestTopic { id: string; name: string; total: number; attempted: number; correct: number; answerCount: number }
export interface TestConfiguration { all: boolean; selected: readonly string[]; count: 10 | 15 | 25 | 40; mode: TestMode; origins: readonly ('O' | 'A' | 'G')[]; timed: boolean; minutes: 10 | 20 | 30 | 45 | 60 }
export interface TestServices {
  loadTopics(): Promise<readonly TestTopic[]>;
  getConfiguration(): TestConfiguration;
  saveConfiguration(configuration: TestConfiguration): void;
  seenTopics(): readonly string[];
  start(configuration: TestConfiguration): Promise<'started' | 'empty' | 'account-changed'>;
}
export interface ScenarioChoice { id: string; text: string }
export interface SimulationReviewServices { loadChoices(): Promise<readonly ScenarioChoice[]>; start(id: string): 'started' | 'unavailable'; }
export interface SimulationNavigationServices { openExams(): void }
export type SimulationTab = 'completo' | 'examen' | 'tema';
export interface SimulationConfiguration { count: 40 | 80; minutes: 45 | 60 | 90 | 120; scope: 'vistos' | 'todos'; origins: readonly ('O' | 'A' | 'G')[]; includeSecondPart: boolean }
export interface SimulationExam { id: string; name: string; questionCount: number; attempts: number; latest: number | null; best: number | null }
export interface SimulationExamGroups { official: readonly SimulationExam[]; academy: readonly SimulationExam[]; topicTests: readonly SimulationExam[] }
export interface SimulationServices {
  openExams(): void;
  getTab(): SimulationTab; setTab(tab: SimulationTab): void;
  getConfiguration(): SimulationConfiguration; saveConfiguration(configuration: SimulationConfiguration): void;
  seenTopics(): readonly string[];
  loadExamGroups(): Promise<SimulationExamGroups>;
  getSelectedExam(): string | null; selectExam(id: string): void;
  startConfigured(configuration: SimulationConfiguration): Promise<'started' | 'empty' | 'account-changed'>;
  startExam(id: string, mode: 'study' | 'exam'): Promise<'started' | 'empty' | 'account-changed'>;
}
export interface ResultHighlight { id: string; field: 'statement' | `option:${number}`; start: number; end: number; text: string; before: string; after: string; category: 'key' | 'doubt'; contentRevision: string; createdAt: number; timing: 'before-answer' | 'after-answer' | 'after-reveal'; stale?: boolean }
export interface ResultItem { id: string; topicId: string; topicName: string; statement: string; options: readonly string[]; correctIndex: number; answer?: number; outcome: 'correct' | 'wrong' | 'blank' | 'revealed'; notice: string; source: string; citation?: string; note?: string; confidence?: 'sure' | 'betweenTwo' | 'guess'; discardedOptions: readonly number[]; highlights: readonly ResultHighlight[]; contentRevision: string }
export interface ResultSnapshot { score: number; correct: number; wrong: number; blank: number; consulted: number; accuracy: number | null; seconds: number; title: string; interrupted: boolean; kind: 'sim' | 'rev' | 'test'; porTiempo: boolean; analysis: string; secondPartAvailable: boolean; topics: readonly { id: string; name: string; correct: number; total: number }[]; items: readonly ResultItem[] }
export interface ResultReport { reason: string; note: string; state: ErrorReportRecord['state'] }
export interface ResultServices {
  getSnapshot(): ResultSnapshot | null; subscribe(listener: () => void): () => void;
  continuePartTwo(): void; repeatFailures(): boolean; goHome(): void;
  loadStrategy(): Promise<string>;
  loadExplanation(item: Pick<ResultItem, 'id' | 'statement' | 'options'>): Promise<{ status: 'current' | 'outdated' | 'missing'; content?: string }>;
  getReport(id: string): ResultReport | undefined; saveReport(id: string, topicId: string, reason: string, note: string): void;
}
export type StatsTopic = TopicProgress;
export interface StatsServices {
  load(): Promise<StatsSnapshot>; getPreference(key: 'domainOrder' | 'evolution'): Record<string, string | number | boolean>; savePreference(key: 'domainOrder' | 'evolution', value: Record<string, string | number | boolean>): void;
  compareSimulations(firstId: string, secondId: string): StatsComparison | null;
  loadWeekly(filter: { topic?: string; type?: string; weeks: number }): Promise<readonly StatsWeek[]>;
  loadStudyActivity(weeks: number): Promise<{ questionEvolution: readonly { start: number; seen: number; correct: number; wrong: number; unknown: number }[]; observedStudyTime: ObservedStudyTime }>;
  loadStrategy(days: number): Promise<string>;
  practiceTopics(ids?: readonly string[]): void; reviewDue(): void; practiceFailures(): void; practiceTrap(id: string): Promise<'started' | 'empty'>; practiceSlow(onlyCorrect: boolean): Promise<'started' | 'empty'>;
}
export interface QuizPrompt { id: string; topicId: string; topicName: string; origin: 'O' | 'A' | 'G'; year?: string; statement: string; options: readonly string[]; correctIndex: number; context?: string; assumptionText?: string; hasAssumption: boolean; notice: string; citation?: string; source: string; traps: readonly string[]; provisional: boolean; mayExpire: boolean; variant: boolean; contentRevision: string }
export interface QuizSnapshot { title: string; index: number; count: number; questionIds: readonly string[]; seconds: number; timeLimitSeconds: number | null; remainingSeconds: number | null; readingWaitSeconds: number; readingGateUntil: number; feedback: boolean; timed: boolean; paused: boolean; readingMode: number; prompt: QuizPrompt; answer?: number; studyState: 'unseen' | 'pending' | 'answered' | 'revealed'; review: readonly number[]; answers: readonly (number | undefined)[]; studyStates: readonly ('unseen' | 'pending' | 'answered' | 'revealed')[]; confidence?: 'sure' | 'betweenTwo' | 'guess'; discarded: readonly number[]; highlights: readonly ResultHighlight[]; scoreByLuck: number | null; recentAnswer: readonly [number, number] | null; flagged: boolean; failureReason: number | null; report?: ResultReport; cardExists: boolean }
export type QuizFinishResult = 'finished' | 'cancelled' | 'empty';
export interface QuizServices { getSnapshot(): QuizSnapshot | null; subscribe(listener: () => void): () => void; startCurrentQuestion(): void; persist(): void; tick(): void; setIndex(index: number): void; answer(index: number): void; toggleReview(): void; setConfidence(value: 'sure' | 'betweenTwo' | 'guess'): void; toggleDiscard(index: number): void; reveal(): boolean; markBlank(): void; toggleBlank(): void; setPaused(paused: boolean): void; finish(reason?: 'complete' | 'interrupted' | 'timeout'): Promise<QuizFinishResult>; exit(): Promise<void>; cancelConfirmation(): void; toggleFlag(): void; setFailureReason(reason: number): void; markDoubt(): void; markLuck(): void; toggleCard(): void; addHighlight(anchor: { field: 'statement' | `option:${number}`; sourceText: string; start: number; end: number }, category: 'key' | 'doubt'): boolean; removeHighlight(id: string): void; saveReport(reason: string, note: string): void; loadExplanation(): Promise<{ status: 'current' | 'outdated' | 'missing'; content?: string }> }
export interface SettingsSnapshot {
  sync: { state: string; user: { name: string; email: string } | null; configured: boolean; lastSync: number; error: string; detail: string; host: string; authDomain: string; accessError: string; requests: readonly AccessMember[] };
  full: boolean; level: string; devMode: string | null; devRevealed: boolean; ui: { theme: string; size: number; lectura: number }; training: TrainingPreferences;
  progress: { questions: number; topics: number; sessions: number; openReports: number }; exam: string; version: string; build: string; update: string | null;
  offline: { complete: boolean; missing: readonly string[]; total: number; completedAt: number | null } | null; index: { questions: number; scenarios: number; topics?: readonly { id: string; name: string }[] } | null;
}
export interface SettingsServices {
  accountId(): string | null;
  getSnapshot(): SettingsSnapshot;
  subscribe(listener: () => void): () => void;
  load(): Promise<void>;
  setPreference(key: 'theme' | 'size' | 'lectura', value: string | number): void;
  setTrainingPreferences(value: TrainingPreferences): void;
  setExam(value: string): void;
  setDevMode(value: string | null): void;
  revealDev(): void;
  requestAccess(): Promise<boolean>; login(): Promise<unknown>; logout(): Promise<unknown>; retrySync(): Promise<unknown>;
  checkUpdate(): Promise<string | null | undefined>; applyUpdate(): Promise<void>;
  downloadOffline(progress: (done: number, total: number) => void, isCurrent: () => boolean): Promise<NonNullable<SettingsSnapshot['offline']>>;
  exportAnki(): Promise<string>; exportBackup(): Promise<string>;
  previewBackup(text: string): { summary: string; serialized: string; attemptArchive?: unknown };
  importBackup(serialized: string, attemptArchive?: unknown): Promise<void>;
  resetAll(): void;
  findAiSessions(from: number, to: number, modes: readonly ('practice' | 'simulation')[]): Promise<readonly { id: string; mode: 'practice' | 'simulation'; startedAt: number; attemptCount: number }[]>;
  buildAiExport(input: { from: number; to: number; modes: readonly ('practice' | 'simulation')[]; sessionIds: readonly string[] }): Promise<unknown>;
  deleteAiHistory(): Promise<{ accountSyncPending: boolean }>;
}
export interface StudyServices { access: AccessManagementServices; home: HomeServices; topics: TopicServices; cards: CardsServices; errors: ErrorServices; failures: FailureServices; lightning: LightningServices; traps: TrapsServices; reading: ReadingServices; test: TestServices; simulation: SimulationServices; simulationReview: SimulationReviewServices; result: ResultServices; quiz: QuizServices; stats: StatsServices; settings: SettingsServices; markReady(): void }
const Context = createContext<StudyServices | null>(null);
export const AppServicesProvider = Context.Provider;
function useOptionalStudyServices(): StudyServices | null { return useContext(Context); }
export function useStudyService<K extends keyof StudyServices>(key: K): StudyServices[K] {
  const services = useOptionalStudyServices();
  if (!services) throw new Error('Falta AppServicesProvider');
  return services[key];
}
export function useOptionalStudyService<K extends keyof StudyServices>(key: K): StudyServices[K] | null {
  const services = useOptionalStudyServices();
  return services?.[key] ?? null;
}

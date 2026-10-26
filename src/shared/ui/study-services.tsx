import { createContext, useContext } from 'react';
export interface ActiveStudy { title: string; position: number; total: number }
export interface HomeBlock { name: string; total: number; mastered: number; assessed: number }
export interface HomeOverview {
  completedSessions: number; blocks: HomeBlock[];
  seen: number; total: number; answers: number; streak: number; daysToExam: number | null;
  due: number; cardsDue: number; quickCount: number; slowCount: number; failures: number;
  studiedTopics: number; topicCount: number; assessedTopics: number; weakTopics: number; masteredTopics: number;
}
export interface AccessOverview {
  full: boolean; level: string; greeting: string; state: string; configured: boolean;
  signedIn: boolean; pendingRequests: number;
}
export interface HomeServices {
  loadOverview(): Promise<HomeOverview>;
  accountId(): string | null;
  getAccess(): AccessOverview;
  getActiveStudy(): ActiveStudy | null;
  subscribe(listener: () => void): () => void;
  quickSession(): Promise<void>;
  startReview(): Promise<void>;
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
export interface FailureQuestion { id: string; topicId: string; statement: string; options: readonly string[]; correctIndex: number; citation?: string; note?: string; year?: string; context?: string; assumptionText?: string; traps?: readonly number[]; nonScoring?: number; source?: { url: string; title?: string; page?: number; verified: boolean } }
export interface FailureServices {
  loadQuestions(): Promise<FailureQuestion[]>;
  loadTopics(): Promise<readonly { id: string; name: string }[]>;
  getRecord(id: string): readonly number[] | undefined;
  isReviewed(id: string): boolean;
  setReviewed(id: string, topicId: string, reviewed: boolean): void;
  topicName(id: string): string;
  startPractice(ids: readonly string[], title: string): void;
}
export interface LightningQuestion extends FailureQuestion { reason: string }
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
export interface StudyServices { access: AccessManagementServices; home: HomeServices; topics: TopicServices; cards: CardsServices; errors: ErrorServices; failures: FailureServices; lightning: LightningServices; traps: TrapsServices; reading: ReadingServices; markReady(): void }
const Context = createContext<StudyServices | null>(null);
export const AppServicesProvider = Context.Provider;
export function useStudyServices(): StudyServices {
  const services = useContext(Context);
  if (!services) throw new Error('Falta AppServicesProvider');
  return services;
}

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
export interface StudyServices { access: AccessManagementServices; home: HomeServices; topics: TopicServices; markReady(): void }
const Context = createContext<StudyServices | null>(null);
export const AppServicesProvider = Context.Provider;
export function useStudyServices(): StudyServices {
  const services = useContext(Context);
  if (!services) throw new Error('Falta AppServicesProvider');
  return services;
}

import type { CardMap, ReportMap, SeenDoc, Session, StatMap, StatRec } from '../local/dto/stored-progress.js';

/** Callbacks used by local progress storage to notify the Firebase sync adapter. */
export interface ProgressSyncCallbacks {
  schedule(): void;
  pushSession?(session: Session): void;
  pushSeen?(seen: SeenDoc): void;
  pushReports?(reports: ReportMap): void;
  pushCards?(cards: CardMap): void;
  pushImport?(): void;
}

/** Local-first progress operations required by Firebase synchronization. */
export interface ProgressSyncStore {
  accountId(): string | null;
  switchAccount(accountId: string | null, adoptLegacy?: boolean): void;
  recover(): Promise<boolean>;
  setSyncer(callbacks: ProgressSyncCallbacks | null): void;
  mergeRemote(value: unknown): boolean;
  mergeSessions(value: unknown): boolean;
  getSessions(): Session[];
  mergeSeen(value: unknown): boolean;
  getSeenDoc(): SeenDoc;
  mergeReports(value: unknown): boolean;
  getReports(): ReportMap;
  mergeCards(value: unknown): boolean;
  getCardsDoc(): CardMap;
  cleanCards(value: unknown): CardMap;
  getStats(): StatMap;
  needsSync(local: StatRec, remote?: StatRec): boolean;
  takeDirty(): Set<string>;
}

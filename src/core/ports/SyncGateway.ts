import type { AccessLevel, AccessRequest } from '../domain/entities.js';

export interface SyncStatusSnapshot {
  user: { name: string; email: string; verified?: boolean } | null;
  state: string;
  lastSync: number;
  error: string;
  detail: string;
  configured: boolean;
  host: string;
  authDomain: string;
  access: AccessLevel | '';
  requested: boolean;
  requests: AccessRequest[];
  grants: AccessRequest[];
  accessError: string;
}

export interface SyncGateway {
  getSnapshot(): SyncStatusSnapshot;
  subscribe(listener: (snapshot: SyncStatusSnapshot) => void): () => void;
}

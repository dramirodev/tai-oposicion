import type { SyncStatusSnapshot } from '../../../core/ports/SyncGateway.js';
import type { SyncStatus } from '../sync-status-store.js';

export const syncStatusMapper = {
  toDomain(dto: SyncStatus): SyncStatusSnapshot {
    return {
      user: dto.user ? { name: dto.user.name, email: dto.user.email, ...(dto.user.verified === undefined ? {} : { verified: dto.user.verified }) } : null,
      state: dto.state,
      lastSync: dto.lastSync,
      error: dto.error,
      detail: dto.detail,
      configured: dto.configured,
      host: dto.host,
      authDomain: dto.authDomain,
      access: dto.access,
      requested: dto.requested,
      requests: dto.reqs.map(({ uid, email, name, ts }) => ({ uid, email, ...(name === undefined ? {} : { name }), ...(ts === undefined ? {} : { requestedAt: ts }) })),
      grants: dto.grants.map(({ uid, email, name, ts }) => ({ uid, email, ...(name === undefined ? {} : { name }), ...(ts === undefined ? {} : { requestedAt: ts }) })),
      accessError: dto.accessErr,
    };
  },
};

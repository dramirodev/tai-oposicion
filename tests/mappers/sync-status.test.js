import { describe, expect, it } from 'vitest';
import { syncStatusMapper } from '../../src/adapters/firebase/mappers/sync-status.js';

describe('syncStatusMapper', () => {
  it('translates Firebase timestamp DTO fields into domain access-request dates', () => {
    const dto = {
      user: { name: 'A', email: 'a@example.test' }, state: 'sincronizado', lastSync: 50, error: '', detail: '',
      configured: true, host: 'app.example.test', authDomain: 'app.example.test', access: 'aprobado', requested: false,
      reqs: [{ uid: 'u1', email: 'u1@example.test', ts: 20 }], grants: [], accessErr: '',
    };

    expect(syncStatusMapper.toDomain(dto)).toEqual({
      user: dto.user, state: 'sincronizado', lastSync: 50, error: '', detail: '', configured: true,
      host: 'app.example.test', authDomain: 'app.example.test', access: 'aprobado', requested: false,
      requests: [{ uid: 'u1', email: 'u1@example.test', requestedAt: 20 }],
      grants: [], accessError: '',
    });
  });
});

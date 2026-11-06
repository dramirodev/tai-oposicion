// Run with Firestore emulator on 127.0.0.1:8080 and project demo-tai-bank-atomic.
import { it, expect, vi } from 'vitest';
import { pack, publish } from '../scripts/publish_bank.mjs';

it.skipIf(process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')('Firestore aplica el lote íntegro y rechaza una publicación concurrente obsoleta', async () => {
  const local = 'http://127.0.0.1:8080/v1/projects/demo-tai-bank-atomic/databases/(default)/documents';
  const production = 'https://firestore.googleapis.com/v1/projects/tai-oposicion/databases/(default)/documents';
  const request = globalThis.fetch;
  const collection = 'bank_' + crypto.randomUUID().replaceAll('-', '');
  const demoPath = path => path.replaceAll('projects/tai-oposicion/', 'projects/demo-tai-bank-atomic/')
    .replaceAll('/documents/bank/', '/documents/' + collection + '/');
  const get = name => request(local + '/' + collection + '/' + name, { headers: { authorization: 'Bearer owner' }, redirect: 'error' });
  let simultaneous = false, readers = 0, openBarrier;
  const barrier = new Promise(resolve => { openBarrier = resolve; });
  try {
    vi.stubGlobal('fetch', async (url, init) => {
      if (!url.startsWith(production)) throw new Error('Unexpected URL');
      // Redirect exclusively to this local emulator. Send absolute resource names
      // for the same demo database and isolate this test in its own collection.
      const path = url.slice(production.length).replace('/bank/', '/' + collection + '/');
      const result = await request(local + path, { ...init, body: init.body && demoPath(init.body), redirect: 'error' });
      if (simultaneous && init.method === 'GET') {
        if (++readers === 2) openBarrier();
        await barrier;
      }
      return result;
    });
    const seed = pack(Buffer.from('primera edición'));
    const a = pack(Buffer.from('publicación A')), b = pack(Buffer.from('publicación B'));
    await publish({ seed }, 'owner');
    simultaneous = true;
    const r = await Promise.allSettled([publish({ a }, 'owner'), publish({ b }, 'owner')]);
    expect(r.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(r.find(result => result.status === 'rejected').reason.message).toMatch(/POST :commit: (400|409|412)/);
    const [winner, loser] = r[0].status === 'fulfilled' ? ['a', 'b'] : ['b', 'a'];
    const winningPack = winner === 'a' ? a : b;
    const meta = (await (await get('meta')).json()).fields;
    expect(meta.v.integerValue).toBe('2');
    expect(meta.files.mapValue.fields).toEqual({ [winner]: { stringValue: winningPack.h } });
    const doc = (await (await get('f_' + winner)).json()).fields;
    expect(doc.z.bytesValue).toBe(winningPack.z.toString('base64'));
    expect((await get('f_' + loser)).status).toBe(404);
    expect((await get('f_seed')).status).toBe(404);
  } finally {
    vi.unstubAllGlobals();
  }
});

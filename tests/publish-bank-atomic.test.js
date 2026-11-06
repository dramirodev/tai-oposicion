import { afterEach, expect, it, vi } from 'vitest';
import { pack, publish } from '../scripts/publish_bank.mjs';

const time = '2026-01-01T00:00:00.123456Z';
const file = pack(Buffer.from('contenido'));
const root = 'projects/tai-oposicion/databases/(default)/documents';
const meta = (updateTime, v, hashes) => ({
  updateTime, fields: { v: { integerValue: String(v) }, files: { mapValue: {
    fields: Object.fromEntries(Object.entries(hashes).map(([name, hash]) => [name, { stringValue: hash }])),
  } } },
});
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());

it('agrupa alta, baja y metadatos en un solo commit con la versión leída', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(meta(time, 9, { antiguo: 'old' })))
    .mockResolvedValueOnce(response({ writeResults: [{}, {}, {}] }));
  vi.stubGlobal('fetch', fetch);
  await publish({ nuevo: file }, 'offline');
  expect(fetch.mock.calls.map(c => [c[0], c[1].method])).toEqual([
    ['https://firestore.googleapis.com/v1/' + root + '/bank/meta', 'GET'],
    ['https://firestore.googleapis.com/v1/' + root + ':commit', 'POST'],
  ]);
  const { writes } = JSON.parse(fetch.mock.calls[1][1].body);
  expect(writes).toHaveLength(3);
  expect(writes[0].update).toMatchObject({ name: root + '/bank/f_nuevo', fields: { z: { bytesValue: file.z.toString('base64') } } });
  expect(writes[1]).toEqual({ delete: root + '/bank/f_antiguo' });
  expect(writes[2]).toMatchObject({ update: { name: root + '/bank/meta', fields: { v: { integerValue: '10' } } }, currentDocument: { updateTime: time } });
});

it('la primera publicación requiere ausencia de metadatos y un fallo no dispara escrituras de reserva', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(response({ error: 'ALREADY_EXISTS' }, 409));
  vi.stubGlobal('fetch', fetch);
  await expect(publish({ x: file }, 'offline')).rejects.toThrow('409');
  expect(JSON.parse(fetch.mock.calls[1][1].body).writes.at(-1).currentDocument).toEqual({ exists: false });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('rechaza el segundo publicador con metadatos obsoletos y un reintento puede reconocer el lote ya aplicado', async () => {
  let metadata = meta(time, 1, {});
  const methods = [];
  vi.stubGlobal('fetch', async (_url, req) => {
    methods.push(req.method);
    if (req.method === 'GET') return response(metadata);
    const marker = JSON.parse(req.body).writes.at(-1);
    if (marker.currentDocument.updateTime !== metadata.updateTime) return response({ error: 'FAILED_PRECONDITION' }, 400);
    metadata = { updateTime: '2026-01-01T00:01:00.000000Z', fields: marker.update.fields };
    return response({});
  });
  const results = await Promise.allSettled([publish({ x: file }, 'offline'), publish({ x: file }, 'offline')]);
  expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected']);
  expect(methods).toEqual(['GET', 'GET', 'POST', 'POST']);
  await publish({ x: file }, 'offline');
  expect(methods.at(-1)).toBe('GET');
  expect(methods).toHaveLength(5);
  expect(metadata.fields.v.integerValue).toBe('2');
});

it('rehúsa peticiones sobredimensionadas antes de enviar el primer POST', async () => {
  const fetch = vi.fn(async () => response({}, 404));
  vi.stubGlobal('fetch', fetch);
  await expect(publish(Object.fromEntries(Array.from({ length: 500 }, (_, i) => [i, file])), 'offline')).rejects.toThrow('500');
  const large = { ...file, z: Buffer.alloc(899_999) };
  await expect(publish(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, large])), 'offline')).rejects.toThrow('10 MiB');
  expect(fetch.mock.calls.map(c => c[1].method)).toEqual(['GET', 'GET']);
});

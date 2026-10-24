// Publica el banco (public/data/*.json) en Firestore como documentos comprimidos: bank/f_<nombre> y bank/meta.
// Solo sube lo que ha cambiado (compara hashes con bank/meta). No necesita dependencias: usa la API REST de Firestore.
//   ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/publish_bank.mjs [--dry]
// La cuenta del token necesita permiso de escritura en Firestore del proyecto (p. ej. propietario). Las reglas no se aplican a IAM.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

export const PROJECT = 'tai-oposicion';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/bank`;

/** Empaqueta un fichero: hash del contenido y gzip. */
export function pack(buf) { return { h: createHash('sha1').update(buf).digest('hex').slice(0, 16), z: gzipSync(buf, { level: 9 }) }; }
/** Qué ficheros hay que subir o borrar según los hashes remotos. */
export function plan(local, remote) {
  const up = Object.keys(local).filter(n => remote[n] !== local[n]);
  const del = Object.keys(remote).filter(n => !(n in local));
  return { up, del };
}
export const loadLocal = (dir = join(root, 'public', 'data')) =>
  Object.fromEntries(readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => [f.slice(0, -5), pack(readFileSync(join(dir, f)))]));

async function api(method, path, token, body) {
  const r = await fetch(base + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (r.status === 404 && method === 'GET') return null;
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function main() {
  const token = process.env.ACCESS_TOKEN, dry = process.argv.includes('--dry');
  if (!token && !dry) { console.error('Falta ACCESS_TOKEN (gcloud auth print-access-token).'); process.exit(1); }
  const local = loadLocal(), hashes = Object.fromEntries(Object.entries(local).map(([n, p]) => [n, p.h]));
  let remote = {}, v = 0;
  if (token) {
    const m = await api('GET', '/meta', token);
    if (m) { v = +(m.fields.v?.integerValue || 0); for (const [n, x] of Object.entries(m.fields.files?.mapValue?.fields || {})) remote[n] = x.stringValue; }
  }
  const { up, del } = plan(hashes, remote);
  const kb = up.reduce((a, n) => a + local[n].z.length, 0) / 1024;
  console.log(`${Object.keys(local).length} ficheros · a subir ${up.length} (${kb.toFixed(0)} KB comprimidos) · a borrar ${del.length}${dry ? ' · (simulación)' : ''}`);
  for (const n of up) { const z = local[n].z; if (z.length > 900_000) throw new Error(`${n} comprimido ocupa ${z.length} B: no cabe en un documento`); }
  if (dry || (!up.length && !del.length)) return;
  for (const n of up) {
    await api('PATCH', '/f_' + n, token, { fields: { n: { stringValue: n }, h: { stringValue: local[n].h }, z: { bytesValue: local[n].z.toString('base64') } } });
    console.log('  subido', n);
  }
  for (const n of del) { await api('DELETE', '/f_' + n, token); console.log('  borrado', n); }
  // meta al final: los clientes no ven hashes nuevos hasta que los ficheros ya están subidos
  await api('PATCH', '/meta', token, { fields: { v: { integerValue: String(v + 1) }, ts: { integerValue: String(Date.now()) },
    files: { mapValue: { fields: Object.fromEntries(Object.entries(hashes).map(([n, h]) => [n, { stringValue: h }])) } } } });
  console.log('meta v' + (v + 1) + ' publicada');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(1); });

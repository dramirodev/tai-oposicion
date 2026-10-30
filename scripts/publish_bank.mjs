// Publica el banco (public/data/*.json) y las tarjetas (public/cards/*.json, como cards_<nombre>) en Firestore como documentos comprimidos: bank/f_<nombre> y bank/meta.
// Solo sube lo que ha cambiado (compara hashes con bank/meta). No necesita dependencias: usa la API REST de Firestore.
//   ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/publish_bank.mjs [--dry]
// La cuenta del token necesita permiso de escritura en Firestore del proyecto (p. ej. propietario). Las reglas no se aplican a IAM.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
  const up = Object.keys(local).filter(name => remote[name] !== local[name]);
  const del = Object.keys(remote).filter(name => !(name in local));
  return { up, del };
}
const packDirectory = (dir, prefix = '') => existsSync(dir)
  ? Object.fromEntries(readdirSync(dir).filter(textValue => textValue.endsWith('.json')).sort().map(textValue => [prefix + textValue.slice(0, -5), pack(readFileSync(join(dir, textValue)))]))
  : {};
/** Banco (`data/*`), tarjetas (`cards_*`) y explicaciones (`explanations_*`): ninguno se despliega ya como JSON estático. */
export const loadLocal = (dir = join(root, 'public', 'data'), cardsDir = join(root, 'public', 'cards'), explanationsDir = join(root, 'public', 'explanations')) => ({
  ...packDirectory(dir), ...packDirectory(cardsDir, 'cards_'), ...packDirectory(explanationsDir, 'explanations_'),
});

async function api(method, path, token, body) {
  const response = await fetch(base + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json();
}
async function main() {
  const token = process.env.ACCESS_TOKEN, dry = process.argv.includes('--dry');
  if (!token && !dry) { console.error('Falta ACCESS_TOKEN (gcloud auth print-access-token).'); process.exit(1); }
  const local = loadLocal(), hashes = Object.fromEntries(Object.entries(local).map(([name, priorValue]) => [name, priorValue.h]));
  let remote = {}, remoteVersion = 0;
  if (token) {
    const metadata = await api('GET', '/meta', token);
    if (metadata) { remoteVersion = +(metadata.fields.v?.integerValue || 0); for (const [name, hashField] of Object.entries(metadata.fields.files?.mapValue?.fields || {})) remote[name] = hashField.stringValue; }
  }
  const { up, del } = plan(hashes, remote);
  const kb = up.reduce((compressedBytes, fileName) => compressedBytes + local[fileName].z.length, 0) / 1024;
  console.log(`${Object.keys(local).length} ficheros · a subir ${up.length} (${kb.toFixed(0)} KB comprimidos) · a borrar ${del.length}${dry ? ' · (simulación)' : ''}`);
  for (const nameItem of up) { const bytes = local[nameItem].z; if (bytes.length > 900_000) throw new Error(`${nameItem} comprimido ocupa ${bytes.length} B: no cabe en un documento`); }
  if (dry || (!up.length && !del.length)) return;
  for (const nameEntry of up) {
    await api('PATCH', '/f_' + nameEntry, token, { fields: { n: { stringValue: nameEntry }, h: { stringValue: local[nameEntry].h }, z: { bytesValue: local[nameEntry].z.toString('base64') } } });
    console.log('  subido', nameEntry);
  }
  for (const nameValue of del) { await api('DELETE', '/f_' + nameValue, token); console.log('  borrado', nameValue); }
  // meta al final: los clientes no ven hashes nuevos hasta que los ficheros ya están subidos
  await api('PATCH', '/meta', token, { fields: { v: { integerValue: String(remoteVersion + 1) }, ts: { integerValue: String(Date.now()) },
    files: { mapValue: { fields: Object.fromEntries(Object.entries(hashes).map(([name, hash]) => [name, { stringValue: hash }])) } } } });
  console.log('meta v' + (remoteVersion + 1) + ' publicada');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exit(1); });

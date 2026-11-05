// Publica el banco (public/data/*.json) y las tarjetas (public/cards/*.json, como cards_<nombre>) en Firestore como documentos comprimidos: bank/f_<nombre> y bank/meta.
// Solo sube lo que ha cambiado (compara hashes con bank/meta). No necesita dependencias: usa la API REST de Firestore.
//   ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/publish_bank.mjs [--dry]
// La cuenta del token necesita permiso de escritura en Firestore del proyecto (p. ej. propietario). Las reglas no se aplican a IAM.
import { existsSync, realpathSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

export const PROJECT = 'tai-oposicion';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const documents = `projects/${PROJECT}/databases/(default)/documents`;
const endpoint = 'https://firestore.googleapis.com/v1/' + documents;

/** Empaqueta un fichero: hash del contenido y gzip. */
export function pack(buf) { return { sha256: createHash('sha256').update(buf).digest('hex'), h: createHash('sha1').update(buf).digest('hex').slice(0, 16), z: gzipSync(buf, { level: 9 }) }; }
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
export function loadLocal(dir = join(root, 'public', 'data'), cardsDir = join(root, 'public', 'cards'), explanationsDir = join(root, 'public', 'explanations'), approvedRelease) {
  const bank = packDirectory(dir);
  if (approvedRelease) verifyApprovedBank(bank, approvedRelease);
  return { ...bank, ...packDirectory(cardsDir, 'cards_'), ...packDirectory(explanationsDir, 'explanations_') };
}

/** Fail before the first network request and verify the exact bytes that will be published. */
export function verifyApprovedBank(files, manifest) {
  if (manifest.schemaVersion !== 1 || !Object.keys(manifest.files ?? {}).length) {
    throw new Error('Manifiesto de revisión del banco ausente o incompatible.');
  }
  const names = Object.keys(files);
  const expected = Object.keys(manifest.files);
  if (expected.length !== names.length) throw new Error('El inventario del banco difiere del aprobado.');
  for (const [name, packed] of Object.entries(files)) {
    if (manifest.files[name + '.json']?.approvedSha256 !== packed.sha256) {
      throw new Error('Archivo del banco sin aprobación editorial: ' + name);
    }
  }
}

async function api(method, path, token, body) {
  const response = await fetch(endpoint + path, {
    method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body,
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

export async function publish(local, token, dry = false) {
  if (!token && !dry) throw new Error('Falta ACCESS_TOKEN (gcloud auth print-access-token).');
  const hashes = Object.fromEntries(Object.entries(local).map(([name, packed]) => [name, packed.h]));
  const metadata = token ? await api('GET', '/bank/meta', token) : null;
  if (metadata && !metadata.updateTime) throw new Error('Falta updateTime en el documento bank/meta.');
  const remote = Object.fromEntries(Object.entries(metadata?.fields.files?.mapValue?.fields || {})
    .map(([name, hash]) => [name, hash.stringValue]));
  const { up, del } = plan(hashes, remote);
  const kb = up.reduce((bytes, name) => bytes + local[name].z.length, 0) / 1024;
  console.log(`${Object.keys(local).length} ficheros · a subir ${up.length} (${kb.toFixed(0)} KB comprimidos) · a borrar ${del.length}${dry ? ' · (simulación)' : ''}`);
  if (!up.length && !del.length) return;
  if (up.length + del.length + 1 > 500) throw new Error('El commit supera 500 escrituras, incluido bank/meta.');

  const filePath = name => {
    if (!name || name.includes('/')) throw new Error('Nombre de fichero de banco inválido.');
    return documents + '/bank/f_' + name;
  };
  const writes = up.map(name => {
    const { z, h } = local[name];
    if (z.length > 900_000) throw new Error(`${name} comprimido ocupa ${z.length} B: no cabe en un documento`);
    return { update: { name: filePath(name), fields: {
      n: { stringValue: name }, h: { stringValue: h }, z: { bytesValue: z.toString('base64') },
    } } };
  });
  for (const name of del) writes.push({ delete: filePath(name) });

  const version = Number(metadata?.fields.v?.integerValue ?? 0) + 1;
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Versión de bank/meta inválida.');
  writes.push({
    update: { name: documents + '/bank/meta', fields: {
      v: { integerValue: String(version) }, ts: { integerValue: String(Date.now()) },
      files: { mapValue: { fields: Object.fromEntries(Object.entries(hashes).map(([name, hash]) => [name, { stringValue: hash }])) } },
    } },
    currentDocument: metadata ? { updateTime: metadata.updateTime } : { exists: false },
  });
  const body = JSON.stringify({ writes });
  if (Buffer.byteLength(body) > 10 * 1024 * 1024) throw new Error('El commit supera 10 MiB.');
  if (dry) return;
  await api('POST', ':commit', token, body);
  console.log('meta v' + version + ' publicada');
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(root, 'scripts', 'bank-editorial', 'release.json'), 'utf8'));
  const local = loadLocal(undefined, undefined, undefined, manifest);
  await publish(local, process.env.ACCESS_TOKEN, process.argv.includes('--dry'));
}
if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exit(1); });

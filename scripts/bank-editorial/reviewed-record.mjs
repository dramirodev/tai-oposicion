/** Build/test only. Resolve the exact raw row and the context used by the catalog. */
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const sha = value => createHash('sha256').update(value).digest('hex');
export function readReviewedRecord(entry, root = process.cwd()) {
  const file = entry.storageFile || `public/data/${entry.topic}.json`;
  if (!/^public\/data\/(?:T\d+\.\d{2}|supuestos)\.json$/.test(file)) throw Error(`Invalid reviewed storage ${entry.id}`);
  for (const path of [root, join(root, 'public'), join(root, 'public/data'), join(root, file)]) {
    if (lstatSync(path).isSymbolicLink()) throw Error(`Reviewed source symlink ${entry.id}`);
  }
  if (!lstatSync(join(root, file)).isFile()) throw Error(`Reviewed source is not a file ${entry.id}`);
  const data = JSON.parse(readFileSync(join(root, file), 'utf8'));
  if (file !== 'public/data/supuestos.json') {
    if (file !== `public/data/${entry.topic}.json` || entry.scenarioId) throw Error(`Wrong reviewed location ${entry.id}`);
    const matches = data.filter(q => q.i === entry.id);
    if (matches.length !== 1) throw Error(`Missing/duplicate reviewed ID ${entry.id}`);
    return matches[0];
  }
  const context = entry.context;
  const scenario = data[entry.scenarioId];
  const matches = Object.entries(data).flatMap(([id, value]) => value.q.filter(q => q.i === entry.id).map(q => ({ id, q })));
  if (matches.length !== 1 || matches[0].id !== entry.scenarioId || !context || !scenario ||
      context.storageFile !== file || context.scenarioId !== entry.scenarioId ||
      matches[0].q.s !== entry.scenarioId || matches[0].q.t !== entry.topic ||
      typeof scenario.texto !== 'string' || scenario.texto !== context.supTexto ||
      sha(scenario.texto) !== context.contextSha256) throw Error(`Reviewed context drift ${entry.id}`);
  for (const side of ['before', 'after']) {
    if (sha(JSON.stringify(entry[side])) !== entry[`${side}Sha256`] ||
        sha(JSON.stringify({ scenarioId: entry.scenarioId, supTexto: context.supTexto, question: entry[side] })) !== context[`${side}ContextualSha256`]) {
      throw Error(`Reviewed envelope drift ${entry.id}`);
    }
  }
  if (sha(JSON.stringify(matches[0].q)) !== entry.afterSha256) throw Error(`Reviewed raw row drift ${entry.id}`);
  // The ledger envelope is a transport fingerprint. The app hashes this runtime row.
  return { ...matches[0].q, supTexto: scenario.texto };
}

/** Build only ID/SHA allowlist from reviewed edits and the exact approved local records. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
const hashes = {};
for (const file of ['reviewed-web', 'reviewed-T3.08', 'reviewed-T4.07', 'reviewed-19', 'reviewed-followup', 'reviewed-wave2']) {
  const ledger = read(`scripts/bank-editorial/${file}.json`);
  for (const entry of Array.isArray(ledger) ? ledger : ledger.questions) {
    const topic = entry.topic || (file === 'reviewed-T4.07' ? 'T4.07' : 'T3.08');
    const row = read(`public/data/${topic}.json`).find(q => q.i === entry.id);
    if (!row || hashes[entry.id]) throw Error(`Missing/duplicate approved ID ${entry.id}`);
    for (const [key, value] of Object.entries(entry.after)) {
      if (JSON.stringify(row[key]) !== JSON.stringify(value)) throw Error(`Unapproved drift ${entry.id}.${key}`);
    }
    if (row.np === 1) continue; // Explicit study-only records never receive an approval hash.
    hashes[entry.id] = createHash('sha256').update(JSON.stringify(sorted(row))).digest('hex');
  }
}
if (Object.keys(hashes).length !== 196) throw Error('Expected 68 previous plus 128 reviewed eligible IDs');
writeFileSync('src/core/domain/approved-question-hashes.ts', '/** SHA-256 of sorted-key UTF-8 JSON; generate-content-hashes.mjs. No bank content. */\nexport const approvedQuestionHashes: Readonly<Record<string, string>> = ' + JSON.stringify(hashes, null, 2) + ';\n');

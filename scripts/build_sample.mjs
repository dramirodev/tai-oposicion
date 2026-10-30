// Genera public/sample/<tema>.json: la muestra pública (10 preguntas por tema) que ven los usuarios sin acceso completo.
// El banco completo (public/data/T*.json) y las tarjetas solo se sirven desde Firestore a usuarios aprobados (ver firebase.json).
//   node scripts/build_sample.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SAMPLE_SIZE = 10;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Elige `size` preguntas activas repartidas de forma uniforme por el fichero del tema; es determinista. */
export function pickSample(questions, meta, size = SAMPLE_SIZE) {
  const active = questions.filter(question => !meta[question.i]?.[5]);
  if (active.length <= size) return active;
  return Array.from({ length: size }, (_, index) => active[Math.floor((index + 0.5) * active.length / size)]);
}

/** Escribe una muestra por tema y retira las de temas que ya no existen. Devuelve los temas generados. */
export function buildSample(dataDirectory = join(root, 'public', 'data'), outDirectory = join(root, 'public', 'sample'), size = SAMPLE_SIZE) {
  const meta = JSON.parse(readFileSync(join(dataDirectory, 'meta.json'), 'utf8'));
  const topics = readdirSync(dataDirectory).filter(fileName => /^T\d\.\d\d\.json$/.test(fileName)).sort();
  mkdirSync(outDirectory, { recursive: true });
  for (const fileName of topics) {
    const questions = JSON.parse(readFileSync(join(dataDirectory, fileName), 'utf8'));
    writeFileSync(join(outDirectory, fileName), JSON.stringify(pickSample(questions, meta, size)) + '\n');
  }
  for (const fileName of readdirSync(outDirectory)) if (/\.json$/.test(fileName) && !topics.includes(fileName)) rmSync(join(outDirectory, fileName));
  return topics.map(fileName => fileName.slice(0, -5));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(root, 'public', 'data', 'meta.json'))) { console.error('Falta public/data/meta.json'); process.exit(1); }
  console.log(`${buildSample().length} temas · ${SAMPLE_SIZE} preguntas como máximo por tema → public/sample/`);
}

#!/usr/bin/env node
// Read-only structural audit for the external question-bank authoring files.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const normalizedStatement = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
const suspiciousEncoding = /\uFFFD|ï¿½|Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â[\u0080-\u00BF]|ðŸ/u;

export function auditQuestionBank(groups) {
  const records = groups.flatMap(group => group.questions.map(question => ({ source: group.source, question })));
  const byId = new Map();
  const byStatement = new Map();
  const families = new Map();
  const issues = [];
  const sourceMetadata = [];
  const counts = { total: records.length, bySource: {}, byTopic: {}, byKind: {}, byDifficulty: {}, byReviewState: {}, officialByTemplate: {}, officialAnnulled: 0 };

  for (const group of groups) {
    if (group.source !== 'generated' || !group.metadata) continue;
    const actualTotal = group.questions.length;
    const actualFamilies = new Set(group.questions.map(question => question.familia).filter(Boolean)).size;
    const item = { file: group.file || '(fuente generada)', declaredTotal: group.metadata.total ?? null, actualTotal,
      declaredFamilies: group.metadata.familias ?? null, actualFamilies };
    sourceMetadata.push(item);
    if (item.declaredTotal !== actualTotal) issues.push({ kind: 'generated-metadata-total-mismatch', ...item });
    if (item.declaredFamilies !== actualFamilies) issues.push({ kind: 'generated-metadata-family-mismatch', ...item });
  }

  const issue = (kind, question, details = {}) => issues.push({ kind, id: question.id || '(sin id)', source: question.sourceName, ...details });
  for (const { source, question } of records) {
    counts.bySource[source] = (counts.bySource[source] || 0) + 1;
    counts.byTopic[question.tema || '(sin tema)'] = (counts.byTopic[question.tema || '(sin tema)'] || 0) + 1;
    counts.byKind[question.tipo || '(sin tipo)'] = (counts.byKind[question.tipo || '(sin tipo)'] || 0) + 1;
    counts.byDifficulty[question.dificultad ?? '(sin dificultad)'] = (counts.byDifficulty[question.dificultad ?? '(sin dificultad)'] || 0) + 1;
    if (source === 'literal') {
      const template = question.plantilla || '(sin estado)';
      counts.officialByTemplate[template] = (counts.officialByTemplate[template] || 0) + 1;
      if (question.anulada === true || question.estado === 'anulada') counts.officialAnnulled++;
    }
    if (byId.has(question.id)) issue('duplicate-global-id', question, { otherSource: byId.get(question.id) });
    else byId.set(question.id, source);

    const choices = question.opciones;
    const keys = ['a', 'b', 'c', 'd'];
    const validChoices = choices && keys.every(key => typeof choices[key] === 'string' && choices[key].trim());
    if (!validChoices) issue('invalid-options-shape', question);
    else if (new Set(keys.map(key => choices[key].trim())).size !== 4) issue('duplicate-options-review', question);
    if (!keys.includes(question.correcta)) issue('invalid-answer-key', question, { correct: question.correcta ?? null });

    const textFields = [
      ['enunciado', question.enunciado],
      ...Object.entries(choices || {}).map(([key, value]) => [`opciones.${key}`, value]),
      ['explicacion', question.explicacion],
      ['nota', question.nota],
      ...((question.cita_temario || []).map((citation, index) => [`cita_temario.${index}`, citation.texto])),
    ];
    for (const [field, value] of textFields) {
      if (typeof value === 'string' && suspiciousEncoding.test(value)) {
        issue('suspicious-text-encoding', question, { field });
      }
    }

    if (source === 'generated') {
      const state = question.revision?.estado || '(sin estado)';
      counts.byReviewState[state] = (counts.byReviewState[state] || 0) + 1;
      if (!question.familia) issue('missing-family', question);
      else {
        const family = families.get(question.familia) || [];
        family.push(question);
        families.set(question.familia, family);
      }
      if (!['verificada', 'verificada_parcial'].includes(state)) issue('unknown-review-state', question, { state });
      const citations = question.cita_temario;
      if (!Array.isArray(citations) || !citations.length) issue('missing-citation', question);
      else for (const citation of citations) {
        if (typeof citation.fuente !== 'string' || !citation.fuente.trim()
          || !Number.isInteger(citation.pagina) || citation.pagina < 1
          || typeof citation.texto !== 'string' || !citation.texto.trim()) {
          issue('untraceable-citation', question);
          break;
        }
      }
    }

    if (typeof question.enunciado === 'string' && question.enunciado.trim()) {
      const normalized = normalizedStatement(question.enunciado);
      const matches = byStatement.get(normalized) || [];
      matches.push({ source, question });
      byStatement.set(normalized, matches);
    }
  }

  const familySizes = {};
  for (const [family, questions] of families) {
    familySizes[questions.length] = (familySizes[questions.length] || 0) + 1;
    if (questions.length !== 3) issues.push({ kind: 'family-size-review', family, ids: questions.map(question => question.id) });
    if (new Set(questions.map(question => question.tema)).size > 1) {
      issues.push({ kind: 'family-cross-topic-review', family, ids: questions.map(question => question.id) });
    }
  }
  const duplicateStatements = [...byStatement.values()].filter(questions => questions.length > 1);
  for (const questions of duplicateStatements) {
    issues.push({ kind: 'repeated-statement-review', ids: questions.map(({ question }) => question.id), topics: [...new Set(questions.map(({ question }) => question.tema))] });
  }
  const generatedDuplicateStatements = duplicateStatements.filter(questions => questions.every(record => record.source === 'generated'));

  return {
    counts,
    generatedFamilyCount: families.size,
    generatedFamilySizes: familySizes,
    generatedSourceMetadata: sourceMetadata,
    repeatedStatementGroups: duplicateStatements.length,
    generatedRepeatedStatementGroups: generatedDuplicateStatements.length,
    issues,
    semanticReview: 'Enunciado, respuesta única, vigencia, epígrafe y valor de variantes requieren cotejo humano en los PDF fuente del temario; este informe no los infiere.',
  };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--bank-dir' || argv[index] === '--data-dir') {
      values[argv[index].slice(2)] = argv[++index];
    }
  }
  return values;
}

export function auditFiles(bankDir, dataDir) {
  const generatedGroups = readdirSync(join(bankDir, 'generadas')).filter(name => /^banco_generado_T.*\.json$/.test(name)).sort()
    .map(name => {
      const data = readJson(join(bankDir, 'generadas', name));
      return { source: 'generated', file: name, metadata: data.meta, questions: data.preguntas };
    });
  const groups = [
    { source: 'literal', questions: readJson(join(bankDir, 'banco_literal.json')).preguntas },
    { source: 'academy', questions: readJson(join(bankDir, 'banco_academia.json')).preguntas },
    ...generatedGroups,
  ];
  const result = auditQuestionBank(groups);
  if (dataDir) {
    const index = readJson(join(dataDir, 'index.json'));
    const questions = index.temas.flatMap(topic => readJson(join(dataDir, `${topic.id}.json`)));
    result.snapshot = {
      topicCount: index.temas.length,
      questionCount: questions.length,
      byOrigin: Object.fromEntries(['O', 'A', 'G'].map(origin => [origin, questions.filter(question => question.o === origin).length])),
      generatedVerificationFlags: Object.fromEntries([0, 1, '(ausente)'].map(flag => [flag,
        questions.filter(question => question.o === 'G' && (question.v === undefined ? '(ausente)' : question.v) === flag).length])),
      generatedFamilyCount: new Set(questions.filter(question => question.o === 'G').map(question => question.f).filter(Boolean)).size,
      officialProvisionalCount: questions.filter(question => question.o === 'O' && question.p === 1).length,
      officialReservedCount: questions.filter(question => question.o === 'O' && question.r === 1).length,
      officialNonScoringCount: questions.filter(question => question.o === 'O' && question.np === 1).length,
    };
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const args = parseArgs(process.argv.slice(2));
  if (!args['bank-dir']) {
    console.error('Uso: node scripts/audit-bank.mjs --bank-dir <BANCO_PREGUNTAS> [--data-dir <public/data>]');
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(`${JSON.stringify(auditFiles(args['bank-dir'], args['data-dir'] || join(root, 'public/data')), null, 2)}\n`);
    } catch (error) {
      console.error(`No se pudo auditar el banco: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}

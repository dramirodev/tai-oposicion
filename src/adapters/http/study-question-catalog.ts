import { verifyQuestionContent } from './question-content-verification.js';
import { applyEditorialScoring, questionReviewOverride } from '../../core/domain/question-review-overrides.js';
import { diagnoseQuestionDtos } from './question-diagnostics.js';
import type { StudyCatalogIndex as Index, StudyQuestionMetadata as Meta } from '../../core/domain/study-catalog.js';
import type { QuestionRecord as Question } from '../../core/domain/question-record.js';
interface ScenarioEntry { texto: string; q: Question[]; conv?: string }
type RemoteBankLoader = <T>(topicId: string) => Promise<T | null>;
let remoteBankLoader: RemoteBankLoader = async () => null;
export function configureRemoteBankLoader(loader: RemoteBankLoader): void { remoteBankLoader = loader; }
let sampleOnly: () => boolean = () => false;
/** Sin acceso completo solo existe la muestra pública de cada tema (`sample/<tema>.json`). */
export function configureBankSample(isSampleOnly: () => boolean): void { sampleOnly = isSampleOnly; }
/** Las cachés por tema distinguen la muestra del banco completo: al obtener acceso no deben servir la muestra. */
export const topicCacheKey = (topicId: string): string => sampleOnly() ? `sample:${topicId}` : topicId;
// ───────── study catalog ─────────
let catalogIndex: Index | undefined;
let questionMetadata: Meta | undefined;
let scenarios: Record<string, ScenarioEntry> | undefined;
const supQuestions = new Map<string, Question>();
const cache = new Map<string, Promise<Question[]>>();
let scenariosLoading: Promise<Record<string, ScenarioEntry>> | undefined;
const bankFileMatch = /^(data|cards|explanations)\/([\w.-]+)\.json$/, topicFileMatch = /^data\/(T\d+\.\d{2})\.json$/;
/** Nombre del fichero en `bank/f_<nombre>`: los de `cards/` y `explanations/` llevan prefijo para no chocar con `index`. */
const bankName = (url: string): string | null => { const match = bankFileMatch.exec(url); return match ? (match[1] === 'data' ? match[2] : `${match[1]}_${match[2]}`) : null; };
/** Resuelve un fichero del banco: datos de Firestore (solo aprobados), muestra pública (invitados) o URL estática. */
async function resolveBankFile<T>(url: string): Promise<{ data: T } | { target: string }> {
  const name = bankName(url), topic = topicFileMatch.exec(url), sample = !!topic && sampleOnly();
  if (name && !sample) { const remoteBankData = await remoteBankLoader<T>(name); if (remoteBankData !== null) return { data: remoteBankData }; }
  return { target: sample ? `sample/${topic![1]}.json` : url };
}
export async function fetchBankResponse(url: string, init?: RequestInit): Promise<Response> {
  const resolved = await resolveBankFile<unknown>(url);
  return 'data' in resolved ? new Response(JSON.stringify(resolved.data), { headers: { 'content-type': 'application/json' } }) : fetch(resolved.target, init);
}
export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const resolved = await resolveBankFile<T>(url); // el banco puede venir de Firestore; si no, JSON estático (o la muestra para invitados)
  if ('data' in resolved) return resolved.data;
  const response = await fetch(resolved.target); if (!response.ok) throw new Error(resolved.target); return response.json(); }
export async function getIndex(): Promise<Index> { return (catalogIndex ||= await fetchJson<Index>('data/index.json')); }
let metaLoading: Promise<Meta> | undefined;
export async function getMetadataIndex(): Promise<Meta> {
  if (questionMetadata) return questionMetadata;
  if (!metaLoading) metaLoading = (async () => {
    const meta = await fetchJson<Meta>('data/meta.json');
    const by: Record<string, string[]> = {};
    for (const id in meta) {
      if (meta[id][5]) continue;
      (by[meta[id][0]] ||= []).push(id);
    }
    meta._by = by; questionMetadata = meta;
    return meta;
  })().finally(() => { metaLoading = undefined; });
  return metaLoading;
}
export async function getMetadata(): Promise<Meta> {
  const meta = await getMetadataIndex();
  // Supuestos are only needed by question loading; metadata-only screens need not wait for them.
  try { await getScenarios(); } catch {}
  return meta;
}
export const getMetadataSnapshot = (): Meta | undefined => questionMetadata;
export const getTopicForQuestion = (questionId: string): string | null => questionMetadata?.[questionId]?.[0] || supQuestions.get(questionId)?.t || null;
export const getQuestionIdsForTopic = (topicId: string): string[] => [...(questionMetadata?._by[topicId] || []), ...[...supQuestions.values()].filter(question => question.t === topicId).map(question => question.i)];
export const getAllQuestionIdsForTopic = (topicId: string): string[] => [...getQuestionIdsForTopic(topicId), ...Object.entries(questionMetadata || {}).filter(([, entry]) => entry?.[0] === topicId && entry[5]).map(([id]) => id)];
export async function getTopicQuestions(topicId: string): Promise<Question[]> { const key = topicCacheKey(topicId); if (!cache.has(key)) cache.set(key, fetchJson<Question[]>(`data/${topicId}.json`).then(async questionRows => { diagnoseQuestionDtos(questionRows); return (await Promise.all(questionRows.map(verifyQuestionContent))).map(applyEditorialScoring); }).catch(error => { cache.delete(key); throw error; })); return cache.get(key)!; }
export async function getScenarios(): Promise<Record<string, ScenarioEntry>> {
  if (scenarios) return scenarios;
  if (!scenariosLoading) scenariosLoading = fetchJson<Record<string, ScenarioEntry>>('data/supuestos.json').then(async data => {
    const entries = await Promise.all(Object.entries(data).map(async ([id, scenario]) => {
      // Bind the exact context before verification, including the empty string.
      const texto = scenario.texto;
      const contextual = await Promise.all(scenario.q.map(question =>
        verifyQuestionContent({ ...question, supTexto: texto }).then(applyEditorialScoring)));
      return { id, scenario, contextual };
    }));
    scenarios = Object.fromEntries(entries.map(({ id, scenario, contextual }) => {
      // Check again after all digests: a changed context cannot reuse a captured proof.
      const current = contextual.map(question => question.supTexto === scenario.texto ? question
        : applyEditorialScoring({ ...question, supTexto: scenario.texto }));
      current.forEach(question => supQuestions.set(question.i, question));
      // Keep unrelated historical rows unchanged; reviewed rows carry their contextual proof.
      const q = scenario.q.map((question, index) => questionReviewOverride(question.i) ? current[index] : question);
      return [id, { ...scenario, q }];
    }));
    return scenarios;
  }).finally(() => { scenariosLoading = undefined; });
  return scenariosLoading;
}
export const getTopicName = (topicId: string): string => (catalogIndex?.temas.find(topic => topic.id === topicId)?.nombre) || topicId;

export const now = (): number => Date.now();

export async function getQuestions(ids: string[]): Promise<Question[]> {
  await getMetadata();
  const canonicalIds = ids.map(questionId => questionMetadata?.[questionId]?.[5] || questionId);
  const requiredTopics = new Set(canonicalIds.map(questionId => questionMetadata?.[questionId]?.[0]).filter((topicId): topicId is string => Boolean(topicId)));
  const questionsById = new Map<string, Question>(sampleOnly() ? [] : supQuestions);
  for (const topicQuestions of await Promise.all([...requiredTopics].map(getTopicQuestions))) for (const question of topicQuestions) questionsById.set(question.i, question);
  return canonicalIds.flatMap((canonicalId, index) => {
    const question = questionsById.get(canonicalId);
    if (!question) return [];
    const renamedReview = canonicalId !== ids[index] && questionReviewOverride(canonicalId);
    // A proof binds its ID as well as its content; an alias cannot inherit approval.
    return [applyEditorialScoring({ ...question, i: ids[index], ...(renamedReview ? { np: 1 } : {}) })];
  });
}

export const httpStudyQuestionCatalog = {
  getIndex,
  getMetadataIndex,
  getMetadata,
  getMetadataSnapshot,
  getQuestionIdsForTopic,
  getAllQuestionIdsForTopic,
  getScenarios: async () => Object.fromEntries(Object.entries(await getScenarios()).map(([id, scenario]) => [id, {
    text: scenario.texto,
    questions: scenario.q,
    ...(scenario.conv ? { convocation: scenario.conv } : {}),
  }])),
  getTopicQuestions,
  getQuestions,
  getTopicName,
  getTopicForQuestion,
  now,
};

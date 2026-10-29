import { diagnoseQuestionDtos } from './question-diagnostics.js';
import type { StudyCatalogIndex as Index, StudyQuestionMetadata as Meta } from '../../core/domain/study-catalog.js';
import type { QuestionRecord as Question } from '../../core/domain/question-record.js';
interface ScenarioEntry { texto: string; q: Question[]; conv?: string }
type RemoteBankLoader = <T>(topicId: string) => Promise<T | null>;
let remoteBankLoader: RemoteBankLoader = async () => null;
export function configureRemoteBankLoader(loader: RemoteBankLoader): void { remoteBankLoader = loader; }
// ───────── study catalog ─────────
let catalogIndex: Index | undefined;
let questionMetadata: Meta | undefined;
let scenarios: Record<string, ScenarioEntry> | undefined;
const supQuestions = new Map<string, Question>();
const cache = new Map<string, Promise<Question[]>>();
let scenariosLoading: Promise<Record<string, ScenarioEntry>> | undefined;
export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const dataFileMatch = /^data\/([\w.-]+)\.json$/.exec(url); // el banco puede venir de Firestore; si no, JSON estático
  if (dataFileMatch) { const remoteBankData = await remoteBankLoader<T>(dataFileMatch[1]); if (remoteBankData !== null) return remoteBankData; }
  const response = await fetch(url); if (!response.ok) throw new Error(url); return response.json(); }
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
export async function getTopicQuestions(topicId: string): Promise<Question[]> { if (!cache.has(topicId)) cache.set(topicId, fetchJson<Question[]>(`data/${topicId}.json`).then(questionRows => { diagnoseQuestionDtos(questionRows); return questionRows; }).catch(error => { cache.delete(topicId); throw error; })); return cache.get(topicId)!; }
export async function getScenarios(): Promise<Record<string, ScenarioEntry>> {
  if (scenarios) return scenarios;
  if (!scenariosLoading) scenariosLoading = fetchJson<Record<string, ScenarioEntry>>('data/supuestos.json').then(data => {
    scenarios = data;
    for (const scenario of Object.values(data)) {
      for (const question of scenario.q) supQuestions.set(question.i, { ...question, supTexto: scenario.texto });
    }
    return data;
  }).finally(() => { scenariosLoading = undefined; });
  return scenariosLoading;
}
export const getTopicName = (topicId: string): string => (catalogIndex?.temas.find(topic => topic.id === topicId)?.nombre) || topicId;

export const now = (): number => Date.now();

export async function getQuestions(ids: string[]): Promise<Question[]> {
  await getMetadata();
  const canonicalIds = ids.map(questionId => questionMetadata?.[questionId]?.[5] || questionId);
  const requiredTopics = new Set(canonicalIds.map(questionId => questionMetadata?.[questionId]?.[0]).filter((topicId): topicId is string => Boolean(topicId)));
  const questionsById = new Map<string, Question>(supQuestions);
  for (const topicQuestions of await Promise.all([...requiredTopics].map(getTopicQuestions))) for (const question of topicQuestions) questionsById.set(question.i, question);
  return canonicalIds.flatMap((canonicalId, index) => {
    const question = questionsById.get(canonicalId);
    return question ? [{ ...question, i: ids[index] }] : [];
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

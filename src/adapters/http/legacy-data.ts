import { diagnoseQuestionDtos } from './question-diagnostics.js';
import type { StudyCatalogIndex as Index, StudyQuestionMetadata as Meta } from '../../core/domain/study-catalog.js';
import type { QuestionRecord as Question } from '../../core/domain/question-record.js';
interface SupEntry { texto: string; q: Question[]; conv?: string }
type RemoteBankLoader = <T>(topicId: string) => Promise<T | null>;
let remoteBankLoader: RemoteBankLoader = async () => null;
export function configureRemoteBankLoader(loader: RemoteBankLoader): void { remoteBankLoader = loader; }
// ───────── datos ─────────
export let INDEX: Index | undefined, META: Meta, SUP: Record<string, SupEntry> | undefined;
const supQuestions = new Map<string, Question>();
const cache = new Map<string, Promise<Question[]>>();
let supLoading: Promise<Record<string, SupEntry>> | undefined;
export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const dataFileMatch = /^data\/([\w.-]+)\.json$/.exec(url); // el banco puede venir de Firestore; si no, JSON estático
  if (dataFileMatch) { const remoteBankData = await remoteBankLoader<T>(dataFileMatch[1]); if (remoteBankData !== null) return remoteBankData; }
  const response = await fetch(url); if (!response.ok) throw new Error(url); return response.json(); }
export async function getIndex(): Promise<Index> { return (INDEX ||= await fetchJson<Index>('data/index.json')); }
let metaLoading: Promise<Meta> | undefined;
export async function getMetaIndex(): Promise<Meta> {
  if (META) return META;
  if (!metaLoading) metaLoading = (async () => {
    const meta = await fetchJson<Meta>('data/meta.json');
    const by: Record<string, string[]> = {};
    for (const id in meta) {
      if (meta[id][5]) continue;
      (by[meta[id][0]] ||= []).push(id);
    }
    meta._by = by; META = meta;
    return meta;
  })().finally(() => { metaLoading = undefined; });
  return metaLoading;
}
export async function getMeta(): Promise<Meta> {
  const meta = await getMetaIndex();
  // Supuestos are only needed by question loading; metadata-only screens need not wait for them.
  try { await getSup(); } catch {}
  return meta;
}
export const temaOf = (questionId: string): string | null => META && META[questionId] ? META[questionId][0] : supQuestions.get(questionId)?.t || null;
export const activeIdsOfTema = (topicId: string): string[] => [...(META?._by[topicId] || []), ...[...supQuestions.values()].filter(question => question.t === topicId).map(question => question.i)];
export const idsOfTema = (topicId: string): string[] => [...activeIdsOfTema(topicId), ...Object.entries(META || {}).filter(([, entry]) => entry?.[0] === topicId && entry[5]).map(([id]) => id)];
export async function getTema(topicId: string): Promise<Question[]> { if (!cache.has(topicId)) cache.set(topicId, fetchJson<Question[]>(`data/${topicId}.json`).then(questionRows => { diagnoseQuestionDtos(questionRows); return questionRows; }).catch(error => { cache.delete(topicId); throw error; })); return cache.get(topicId)!; }
export async function getSup(): Promise<Record<string, SupEntry>> {
  if (SUP) return SUP;
  if (!supLoading) supLoading = fetchJson<Record<string, SupEntry>>('data/supuestos.json').then(sup => {
    SUP = sup;
    for (const scenario of Object.values(sup)) {
      for (const question of scenario.q) supQuestions.set(question.i, { ...question, supTexto: scenario.texto });
    }
    return sup;
  }).finally(() => { supLoading = undefined; });
  return supLoading;
}
export const temaName = (topicId: string): string => (INDEX?.temas.find(topic => topic.id === topicId)?.nombre) || topicId;

export const now = (): number => Date.now();

export async function byIds(ids: string[]): Promise<Question[]> {
  await getMeta();
  const canonicalIds = ids.map(questionId => META[questionId]?.[5] || questionId);
  const requiredTopics = new Set(canonicalIds.map(questionId => META[questionId]?.[0]).filter(Boolean));
  const questionsById = new Map<string, Question>(supQuestions);
  for (const topicQuestions of await Promise.all([...requiredTopics].map(getTema))) for (const question of topicQuestions) questionsById.set(question.i, question);
  return canonicalIds.flatMap((canonicalId, index) => {
    const question = questionsById.get(canonicalId);
    return question ? [{ ...question, i: ids[index] }] : [];
  });
}

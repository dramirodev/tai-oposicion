import { loadBank } from '../firebase/legacy-bank.js';
import { diagnoseQuestionDtos } from './question-diagnostics.js';
import type { Index, Meta, Question } from '../legacy/types.js';
interface SupEntry { texto: string; q: Question[] }
// ───────── datos ─────────
export let INDEX: Index | undefined, META: Meta, SUP: Record<string, SupEntry> | undefined;
const supQuestions = new Map<string, Question>();
const cache = new Map<string, Promise<Question[]>>();
export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const dataFileMatch = /^data\/([\w.-]+)\.json$/.exec(url); // el banco puede venir de Firestore; si no, JSON estático
  if (dataFileMatch) { const remoteBankData = await loadBank<T>(dataFileMatch[1]); if (remoteBankData !== null) return remoteBankData; }
  const response = await fetch(url); if (!response.ok) throw new Error(url); return response.json(); }
export async function getIndex(): Promise<Index> { return (INDEX ||= await fetchJson<Index>('data/index.json')); }
let metaLoading: Promise<Meta> | undefined;
export async function getMeta(): Promise<Meta> {
  if (META && SUP) return META;
  if (!metaLoading) metaLoading = (async () => {
    if (!META) {
      const meta = await fetchJson<Meta>('data/meta.json');
      const by: Record<string, string[]> = {};
      for (const id in meta) (by[meta[id][0]] ||= []).push(id);
      meta._by = by; META = meta;
    }
    // Sin supuestos descargados, el banco por temas sigue disponible sin conexión.
    try { await getSup(); } catch {}
    return META;
  })().finally(() => { metaLoading = undefined; });
  return metaLoading;
}
export const temaOf = (questionId: string): string | null => META && META[questionId] ? META[questionId][0] : supQuestions.get(questionId)?.t || null;
export const idsOfTema = (topicId: string): string[] => [...(META?._by[topicId] || []), ...[...supQuestions.values()].filter(question => question.t === topicId).map(question => question.i)];
export async function getTema(topicId: string): Promise<Question[]> { if (!cache.has(topicId)) cache.set(topicId, fetchJson<Question[]>(`data/${topicId}.json`).then(questionRows => { diagnoseQuestionDtos(questionRows); return questionRows; }).catch(error => { cache.delete(topicId); throw error; })); return cache.get(topicId)!; }
export async function getSup(): Promise<Record<string, SupEntry>> {
  const sup = (SUP ||= await fetchJson<Record<string, SupEntry>>('data/supuestos.json'));
  for (const scenario of Object.values(sup)) {
    for (const question of scenario.q) supQuestions.set(question.i, { ...question, supTexto: scenario.texto });
  }
  return sup;
}
export const temaName = (topicId: string): string => (INDEX?.temas.find(topic => topic.id === topicId)?.nombre) || topicId;

export const now = (): number => Date.now();

export async function byIds(ids: string[]): Promise<Question[]> {
  await getMeta();
  const requiredTopics = new Set(ids.map(questionId => META[questionId]?.[0]).filter(Boolean));
  const questionsById = new Map<string, Question>(supQuestions);
  for (const topicQuestions of await Promise.all([...requiredTopics].map(getTema))) for (const question of topicQuestions) questionsById.set(question.i, question);
  return ids.map(questionId => questionsById.get(questionId)).filter((question): question is Question => !!question);
}

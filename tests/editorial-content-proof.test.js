import { it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { verifyQuestionContent } from '../src/adapters/http/question-content-verification.js';
import { canonicalQuestionContent, hasApprovedQuestionContent, hasVerifiedEditorialId } from '../src/core/domain/question-content-proof.js';
import { approvedQuestionHashes } from '../src/core/domain/approved-question-hashes.js';
import { applyEditorialScoring, isEditorialContentBlocked } from '../src/core/domain/question-review-overrides.js';
import { questionNotice } from '../src/shared/presentation/study-content.js';
const read = file => JSON.parse(readFileSync(file, 'utf8'));
import { readReviewedRecord } from '../scripts/bank-editorial/reviewed-record.mjs';
const recent = ['reviewed-19','reviewed-followup','reviewed-wave2','reviewed-admin20','reviewed-legal19','reviewed-programming20','reviewed-web25','reviewed-architecture20','reviewed-languages17','reviewed-web23','reviewed-development11','reviewed-systems20','reviewed-foundations18','reviewed-systems16'].flatMap(f => read(`scripts/bank-editorial/${f}.json`).questions.filter(q=>q.after.np!==1));
const published = ['reviewed-web','reviewed-T3.08','reviewed-T4.07'].flatMap(f => read(`scripts/bank-editorial/${f}.json`).map(entry => {
 const topic=f==='reviewed-T4.07'?'T4.07':'T3.08';
 const after=read(`public/data/${topic}.json`).find(q=>q.i===entry.id);
 const before=structuredClone(after);
 for(const [key,value] of Object.entries(entry.before)) { if(value===null) delete before[key]; else before[key]=value; }
 return {...entry,topic,before,after};
}));
const proposals=[...recent,...published].map(q=>q.scenarioId ? {...q,transport:q,before:{...q.before,supTexto:q.context.supTexto},after:{...q.after,supTexto:q.context.supTexto}} : q);
afterEach(() => vi.unstubAllGlobals());
const crypto = () => vi.stubGlobal('crypto', webcrypto);
it('binds exactly405 reviewed records and rejects405 actual prior records, including after a newer sameID', async () => {
 crypto(); expect(Object.keys(approvedQuestionHashes)).toHaveLength(405);
 for(const entry of proposals) {
   const {id,before,after}=entry;
   expect(readReviewedRecord(entry.transport||entry),id).toEqual(after);
   const fresh=await verifyQuestionContent(after);
   expect(hasApprovedQuestionContent(fresh),id).toBe(true);
   expect(applyEditorialScoring(fresh).np,id).not.toBe(1);
   expect(questionNotice(fresh),id).not.toContain('Solo estudio · no puntuable');
   const old=await verifyQuestionContent(before);
   expect(hasVerifiedEditorialId(id),id).toBe(false);
   expect(applyEditorialScoring(old).np,id).toBe(1);
   expect(questionNotice(old),id).toContain('Solo estudio · no puntuable');
   expect(hasApprovedQuestionContent(fresh),id).toBe(true); // independent record proof survives other source
 }
});
it('binds every field, nested options and context; serialized DTOs and forged metadata have no credential', async () => {
 crypto();
 for(const {after} of proposals) {
  const q=await verifyQuestionContent(after);
  expect(hasApprovedQuestionContent({...q})).toBe(true);
  expect(isEditorialContentBlocked(JSON.parse(JSON.stringify(q)))).toBe(true);
  for(const field of ['q','c','cp','supTexto','s','np','n','u','t','k']) {
   expect(hasApprovedQuestionContent({...q,[field]:field==='np'?1:'mutated'}),field).toBe(false);
  }
  expect(hasApprovedQuestionContent({...q,a:[...q.a].reverse()})).toBe(false);
  expect(hasApprovedQuestionContent({...q,metadata:{approved:true},editoriallyVerified:true})).toBe(false);
  const json={...after,proof:canonicalQuestionContent(after),verified:true};
  expect(hasApprovedQuestionContent(await verifyQuestionContent(json))).toBe(false);
 }
});
it('does not clear explicitnp1, and rejects absent or failing WebCrypto even on re-verification', async () => {
 crypto();const q=await verifyQuestionContent(proposals[0].after);
 expect(hasApprovedQuestionContent(await verifyQuestionContent({...q,np:1}))).toBe(false);
 for(const unavailable of [undefined,{}, {subtle:{digest:async()=>{throw Error('unavailable');}}}]) {
  vi.stubGlobal('crypto',unavailable);
  expect(applyEditorialScoring(await verifyQuestionContent(proposals[0].after)).np).toBe(1);
  expect(applyEditorialScoring(await verifyQuestionContent(q)).np).toBe(1);
 }
});
it('the six approved sample records use exactly the same content verification', async () => {
 crypto();const samples=proposals.filter(q=>q.inSample); expect(samples).toHaveLength(6);
 for(const {id,topic} of samples) {
  const q=read(`public/sample/${topic}.json`).find(q=>q.i===id);
  expect(hasApprovedQuestionContent(await verifyQuestionContent(q)),id).toBe(true);
 }
});
it('rejects mutation during the asynchronous digest', async()=>{
 const q=structuredClone(proposals[0].after);
 vi.stubGlobal('crypto',{subtle:{digest:async(...args)=>{q.a[0]="mutated";return webcrypto.subtle.digest(...args);}}});
 expect(applyEditorialScoring(await verifyQuestionContent(q)).np).toBe(1);
});

it('lightning records only its loaded verified content, never an approvedID with an old or mutated record', async()=>{
 crypto();
 const {createLightningComposition}=await import('../src/app/composition/trainers/lightning-composition.js');
 const entry=proposals[0]; let item=await verifyQuestionContent(structuredClone(entry.after));
 const recordAnswer=vi.fn();
 const service=createLightningComposition({loadQuestionMetadata:async()=>{},readQuestionStats:async()=>({}),loadDueQuestionIds:async()=>[],knownQuestionIds:()=>[item.i],shuffle:x=>x,loadQuestionsById:async()=>[item],sourceFallbacks:{},recordAnswer,topicName:x=>x});
 await service.loadQuestion(); service.record(item.i,item.t,true,1); expect(recordAnswer).toHaveBeenCalledTimes(1);
 item.a[0]='mutated'; service.record(item.i,item.t,true,1); expect(recordAnswer).toHaveBeenCalledTimes(1);
 item=entry.before; expect(await service.loadQuestion()).toBeNull(); service.record(item.i,item.t,true,1); expect(recordAnswer).toHaveBeenCalledTimes(1);
});

it('catalog verifies static/sample and remote rows before scoring, regardless of a metadata claim', async()=>{
 crypto();
 const catalog=await import('../src/adapters/http/study-question-catalog.js');
 const entry=proposals.find(q=>q.id==='AS09-P1-48');
 catalog.configureRemoteBankLoader(async()=>[entry.before]);
 const old=(await catalog.getTopicQuestions('T-proof-old'))[0];
 expect(old.np).toBe(1);
 catalog.configureRemoteBankLoader(async()=>[{...entry.before,approved:true,version:999}]);
 expect((await catalog.getTopicQuestions('T-proof-fake'))[0].np).toBe(1);
 catalog.configureRemoteBankLoader(async()=>[entry.after]);
 const fresh=(await catalog.getTopicQuestions('T-proof-new'))[0];
 expect(hasApprovedQuestionContent(fresh)).toBe(true);
 expect(applyEditorialScoring(old).np).toBe(1);
 catalog.configureRemoteBankLoader(async()=>null);
 vi.stubGlobal('fetch',async()=>new Response(JSON.stringify([entry.after])));
 expect(hasApprovedQuestionContent((await catalog.getTopicQuestions('T-proof-static'))[0])).toBe(true);
 catalog.configureBankSample(()=>true);
 expect(hasApprovedQuestionContent((await catalog.getTopicQuestions('T3.05'))[0])).toBe(true);
 catalog.configureBankSample(()=>false);
});
it('removes missing-figure warnings only for proven recovered content and its projected notice', async()=>{
 crypto(); const {toFailureQuestionView}=await import('../src/app/mappers/study-question-view-mapper.js');
 for(const id of ['AS09-P1-48','AS10B-P1-63']) {
  const {before,after}=proposals.find(q=>q.id===id);
  const q=await verifyQuestionContent(after);
  expect(questionNotice(q)).not.toContain('Esquema o imagen pendiente');
  expect(questionNotice(q)).not.toContain('Solo estudio');
  expect(toFailureQuestionView(q).editorialNotice).not.toContain('Esquema o imagen pendiente');
  expect(toFailureQuestionView(q).editorialNotice).not.toContain('Solo estudio');
  for(const stale of [before,JSON.parse(JSON.stringify(q)),{...q,np:1}]) {
   expect(questionNotice(stale)).toContain('Solo estudio');
   expect(toFailureQuestionView(stale).editorialNotice).toContain('Solo estudio');
  }
 }
});

it('never approves the PHP study-only revision while its source acceptance remains pending',async()=>{
 crypto();const q=read('scripts/bank-editorial/reviewed-wave2.json').questions.find(q=>q.id==='GEN-T3.03-48');
 expect(q.after.np).toBe(1);expect(q.after.w).toBe(1);
 expect(approvedQuestionHashes[q.id]).toBeUndefined();
 expect(hasApprovedQuestionContent(await verifyQuestionContent(q.after))).toBe(false);
 expect(isEditorialContentBlocked(await verifyQuestionContent(q.after))).toBe(true);
});

import { it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createStudyQuestionSelection } from '../src/core/application/study-question-selection.js';
import { createFailuresComposition } from '../src/app/composition/failures/failures-composition.js';
import { createCardsComposition } from '../src/app/composition/cards/cards-composition.js';
import { verifyQuestionContent } from '../src/adapters/http/question-content-verification.js';
import { applyEditorialScoring } from '../src/core/domain/question-review-overrides.js';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const id='GEN-T3.08-57.v2';
const approved=read('public/data/T3.08.json').find(q=>q.i===id);
afterEach(()=>vi.unstubAllGlobals());
function setup(raw=approved) {
 vi.stubGlobal('crypto',webcrypto);
 const stats={[id]:{lastResult:0,failureStreak:0,attempts:1,correct:0,lastSeenAt:1}};
 const load=vi.fn(async ids=>ids.includes(id)?[applyEditorialScoring(await verifyQuestionContent(raw))]:[]);
 const selection=createStudyQuestionSelection({getAllQuestionStats:()=>stats,getPreferences:()=>({})},{getTopicForQuestion:()=> 'T3.08',getQuestions:load});
 return {stats,load,selection};
}
it('cold Falladas loads a reviewed published candidate before excluding its unverified ID',async()=>{
 const {stats,load,selection}=setup();
 const services=createFailuresComposition({accountId:()=>null,loadQuestionMetadata:async()=>{},progressRepository:{getStats:async()=>stats},loadQuestionsById:load,failedQuestionIds:selection.failedQuestionCandidateIds,sourceFallbacks:{}});
 const rows=await services.loadQuestions();
 expect(load).toHaveBeenCalledWith([id]);
 expect(rows.map(q=>q.id)).toEqual([id]);
 expect(rows[0].editorialNotice).not.toContain('Solo estudio');
});
it('cold Cards uses saved card IDs and verifies content without the failed-ID selector',async()=>{
 const {load}=setup();
 const cards=createCardsComposition({loadQuestionMetadata:async()=>{},failedCardQuestionIds:()=>[id],loadQuestionsById:load,loadJson:async()=>({temas:{}}),verifiedSources:{},accountId:()=>null,progress:{getSeenTopics:()=>[],getCardReviews:()=>({})}});
 const rows=await cards.loadAllCards();
 expect(rows.map(q=>q.id)).toEqual(['FC-Q-'+id]);
});

it('cold Falladas still excludes an old source after loading, even after the newer ID was verified',async()=>{
 const old={...approved};
 for(const [key,value] of Object.entries(read('scripts/bank-editorial/reviewed-web.json')[0].before)) {if(value===null)delete old[key];else old[key]=value;}
 const {stats,load,selection}=setup(old);
 const services=createFailuresComposition({accountId:()=>null,loadQuestionMetadata:async()=>{},progressRepository:{getStats:async()=>stats},loadQuestionsById:load,failedQuestionIds:selection.failedQuestionCandidateIds,sourceFallbacks:{}});
 expect(await services.loadQuestions()).toEqual([]);
 expect(load).toHaveBeenCalledWith([id]);
});
const published = ['reviewed-web','reviewed-T3.08','reviewed-T4.07'].flatMap(file=>read(`scripts/bank-editorial/${file}.json`).map(edit=>({...edit,topic:file==='reviewed-T4.07'?'T4.07':'T3.08'})));
it.each(published)('loads the approved published $id and excludes its previous/forged version after reading content',async edit=>{
 vi.stubGlobal('crypto',webcrypto);
 const raw=read(`public/data/${edit.topic}.json`).find(q=>q.i===edit.id);
 const old=structuredClone(raw);
 for(const [key,value] of Object.entries(edit.before)){if(value===null)delete old[key];else old[key]=value;}
 for(const [version,visible] of [[raw,true],[old,false],[{...old,verified:true,approved:true},false]]) {
  const stats={[edit.id]:{failureStreak:0,lastResult:0}};
  const selection=createStudyQuestionSelection({getAllQuestionStats:()=>stats},{getTopicForQuestion:()=>edit.topic});
  const service=createFailuresComposition({accountId:()=>null,loadQuestionMetadata:async()=>{},progressRepository:{getStats:async()=>stats},failedQuestionIds:selection.failedQuestionCandidateIds,loadQuestionsById:async ids=>{expect(ids).toEqual([edit.id]);return[applyEditorialScoring(await verifyQuestionContent(version))];},sourceFallbacks:{}});
  expect((await service.loadQuestions()).map(q=>q.id)).toEqual(visible?[edit.id]:[]);
 }
});

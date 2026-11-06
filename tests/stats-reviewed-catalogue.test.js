import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const mocks = vi.hoisted(() => ({ catalog:{ getMetadataIndex:vi.fn(),getQuestions:vi.fn(),now:()=>1800000000000 },load:vi.fn() }));
vi.mock('../src/app/composition/study/study-engine-composition.js',()=>({ studyQuestionCatalog:mocks.catalog,falladasIds:()=>[],hasActiveRun:()=>false }));
vi.mock('../src/core/application/stats/load-detailed-metrics.js',()=>({ loadDetailedMetrics:mocks.load }));
import { createStatsServices } from '../src/app/composition/stats/stats-composition.js';
import { verifyEditorialQuestion } from '../src/core/domain/question-content-proof.js';
const query={ fromInclusive:0,toExclusive:1800000000001,timeZone:'Europe/Madrid',topicId:'T1.02' };
const original=JSON.parse(readFileSync('public/data/T1.02.json','utf8')).find(row=>row.i==='GEN-T1.02-14');
const digest=async text=>createHash('sha256').update(text).digest('hex');
function services(accountId=()=>null){return createStatsServices({}, {}, {accountId});}
function setup(){
 mocks.catalog.getMetadataIndex.mockResolvedValue({ [original.i]:['T1.02','G','D',[],3],ordinary:['T1.02','O','D',[],1] });
 mocks.load.mockResolvedValue({});
}
it('revalidates exact reviewed content after reload, including attempts without legacy stats',async()=>{
 setup();const proven=await verifyEditorialQuestion(original,digest);mocks.catalog.getQuestions.mockResolvedValue([proven]);
 await services().loadMetrics(query);
 expect(mocks.catalog.getQuestions).toHaveBeenLastCalledWith([original.i]);
 const input=mocks.load.mock.lastCall[0];expect(input.questions.has(original.i)).toBe(true);expect(input.questions.has('ordinary')).toBe(true);
});
it('does not reuse a verified ID hint for changed or unproven content',async()=>{
 setup();const proven=await verifyEditorialQuestion(original,digest);
 for(const row of [{...proven,q:proven.q+' altered'}, {...original}]){
  mocks.catalog.getQuestions.mockResolvedValue([row]);await services().loadMetrics(query);
  expect(mocks.load.mock.lastCall[0].questions.has(original.i)).toBe(false);
 }
});
it('shows load errors instead of certifying a lower count when verification fails',async()=>{
 setup();mocks.catalog.getQuestions.mockRejectedValue(new Error('offline-bank'));
 await expect(services().loadMetrics(query)).rejects.toThrow('offline-bank');
});
it('rejects results if the account changes while verifying the current bank',async()=>{
 setup();let account='first';mocks.catalog.getQuestions.mockImplementation(async()=>{account='second';return [];});
 await expect(services(()=>account).loadMetrics(query)).rejects.toThrow('La cuenta cambió');
});

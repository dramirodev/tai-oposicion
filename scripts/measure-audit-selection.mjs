import {readFileSync} from 'node:fs';
import {runnerImport} from 'vite';
const repo=process.cwd();
const {module:{createStudyQuestionSelection}}=await runnerImport(repo+'/src/core/application/study-question-selection.ts',{root:repo,configFile:false});
const dir=repo+'/public/data/';
const temas=JSON.parse(readFileSync(dir+'index.json')).temas.map(t=>({id:t.id, weight:t.w}));
const bank=Object.fromEntries(temas.map(t=>[t.id,JSON.parse(readFileSync(dir+t.id+'.json'))]));
const engine=createStudyQuestionSelection({getQuestionStats:()=>undefined},{getTopicQuestions:async id=>bank[id]});
for(const count of [40,80])for(const origins of [['O'],['O','G']]){
 let o=0,minO=count,maxO=0,minTopics=36,concurrentDuplicates=0,failed=0;
 for(let seed=1;seed<=400;seed++){
   let state=seed;const rng=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
   const q=await engine.selectWeightedSimulationQuestions(temas,new Set(origins),count,rng);
   const ofi=q.filter(i=>i.o==='O').length,topics=new Set(q.map(i=>i.t)).size;
   minTopics=Math.min(minTopics,topics);minO=Math.min(minO,ofi);maxO=Math.max(maxO,ofi);o+=ofi;
   if(new Set(q.map(i=>i.f||i.i)).size!==q.length)concurrentDuplicates++;
   if(q.length!==count)failed++;
 }
 console.log({count,origins,official:o,generated:400*count-o,minO,maxO,minTopics,concurrentDuplicates,failed});
}

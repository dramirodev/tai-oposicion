import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { screen, cleanup } from '@testing-library/react';
import { renderApp } from './helpers/render-app.js';
import { CardsPage } from '../src/features/cards/CardsPage.js';
import { createCardsComposition } from '../src/app/composition/cards/cards-composition.js';
import { verifyQuestionContent } from '../src/adapters/http/question-content-verification.js';
import { approvedQuestionHashes } from '../src/core/domain/approved-question-hashes.js';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
afterEach(()=>{vi.unstubAllGlobals();cleanup();});
it('68 proven cards project their notice without the stale quarantine warning; explicitnp still wins in the UI',async()=>{
 vi.stubGlobal('crypto',webcrypto);
 const meta=read('public/data/meta.json');
 const raw=Object.keys(approvedQuestionHashes).map(id=>read(`public/data/${meta[id][0]}.json`).find(q=>q.i===id));
 const composition=createCardsComposition({loadQuestionMetadata:async()=>{},failedCardQuestionIds:()=>raw.map(q=>q.i),loadQuestionsById:async()=>Promise.all(raw.map(verifyQuestionContent)),loadJson:async()=>({temas:{}}),verifiedSources:{},accountId:()=>null,progress:{getSeenTopics:()=>[],getCardReviews:()=>({})}});
 const cards=await composition.loadAllCards();expect(cards).toHaveLength(68);
 for(const card of cards)expect(card.editorialNotice,card.id).not.toContain('Solo estudio');
 for(const [card,warning] of [[cards[0],false],[{...cards[0],np:1,editorialNotice:''},true],[{...cards[0],editorialNotice:undefined},true]]) {
  const session={account:null,items:[card],index:0,revealed:false,results:[0,0,0]};
  const services={seenTopics:()=>[card.t],getPreferences:()=>({scope:'vistos',count:20}),getSession:()=>session,loadPlan:async()=>({cards:[card],ids:[card.id],reviews:0,summary:{}}),topicName:()=>card.t,getReport:()=>undefined};
  renderApp(React.createElement(CardsPage),{services:{cards:services,home:{}},initialEntries:['/cards?dailyTraining=activeRecall&trainingTopics='+card.t]});
  await screen.findByRole('button',{name:'Mostrar respuesta'});
  expect(!!screen.queryByText('Solo estudio · no puntuable')).toBe(warning);
  cleanup();
 }
});

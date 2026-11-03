import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { renderApp } from './helpers/render-app.js';
import { screen } from '@testing-library/react';

let view;
afterEach(() => { view?.unmount(); view = undefined; });

it('inicializa el reloj antes de calcular la lectura mínima y no muestra segundos de época Unix', async () => {
  const startedAt = Date.now();
  const progress = {
    items: [{ id:'Q1', topicId:'T1.01', statement:'Pregunta', options:['A', 'B', 'C', 'D'], correctIndex:0, asksForNegative:false, minimumSeconds:30, tokens:[] }],
    index:0, step:2, meaningChoice:0, meaningCorrect:true, selectedWords:[], wordResult:null,
    selectedAnswer:null, answerCorrect:null, startedAt, outcomes:[], complete:false,
  };
  const reading = { getProgress:() => progress, subscribe:() => () => {}, start:async () => progress,
    answerMeaning:() => {}, continueMeaning:() => {}, toggleWord:() => {}, checkWords:() => null,
    showOptions:() => {}, answerOption:() => null, next:() => progress, reset:() => {} };
  const { ReadingPage } = await import('../src/features/trainers/ReadingPage.js');
  view = renderApp(React.createElement(ReadingPage), { services:{ reading } });
  expect(screen.getByRole('status')).toHaveTextContent('Lectura mínima: 30 s');
  expect(view.container).not.toHaveTextContent(/Lectura mínima: 1\d{9,} s/);
});

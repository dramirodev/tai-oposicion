import { describe, expect, it } from 'vitest';
import { getTrapChoicePresentation } from '../../src/features/trainers/trap-choice-presentation.js';

const base = { trapLabel: 'Negación doble', selected: false, correct: false, revealed: false, wasSelected: false };

describe('getTrapChoicePresentation', () => {
  it('keeps the selectable state before revealing the answer', () => {
    expect(getTrapChoicePresentation({ ...base, selected: true })).toEqual({ className: 'on', label: 'Negación doble', icon: null });
  });

  it('labels a selected correct trap', () => {
    expect(getTrapChoicePresentation({ ...base, correct: true, revealed: true, wasSelected: true })).toEqual({ className: 'ok', label: 'Detectada: Negación doble', icon: 'check' });
  });

  it('identifies a missed correct trap', () => {
    expect(getTrapChoicePresentation({ ...base, correct: true, revealed: true })).toEqual({ className: 'sug', label: 'No la viste: Negación doble', icon: 'circle' });
  });

  it('identifies a false alarm and leaves other revealed options neutral', () => {
    expect(getTrapChoicePresentation({ ...base, revealed: true, wasSelected: true })).toEqual({ className: 'bad', label: 'Falsa alarma: Negación doble', icon: 'circle-x' });
    expect(getTrapChoicePresentation({ ...base, revealed: true })).toEqual({ className: '', label: 'Negación doble', icon: null });
  });
});

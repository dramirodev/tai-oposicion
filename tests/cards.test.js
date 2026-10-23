import { describe, it, expect } from 'vitest';
import { validateAll } from '../scripts/validate_cards.mjs';
describe('tarjetas curadas (public/cards)', () => {
  it('todos los ficheros de tarjetas cumplen el formato del plan', () => {
    const { errs } = validateAll();
    expect(errs).toEqual([]);
  });
});

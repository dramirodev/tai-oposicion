import { afterEach, expect, it, vi } from 'vitest';
import { clearCardsSession, readCardsSession, saveCardsSession } from '../../src/adapters/local/cards-session.js';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it('guarda, lee y borra una sesión de tarjetas aislada por cuenta', () => {
  const checkpoint = { ids:['card-a','card-b'], index:1, revealed:true, results:[0,0,1] };
  saveCardsSession('account-a', checkpoint);
  expect(readCardsSession('account-a')).toEqual(checkpoint);
  expect(readCardsSession('account-b')).toBeNull();
  clearCardsSession('account-a');
  expect(readCardsSession('account-a')).toBeNull();
});

it('descarta snapshots corruptos, repetidos o inconsistentes', () => {
  localStorage.setItem('tai.cards-session.v1.account-a', JSON.stringify({ ids:['same','same'], index:1, revealed:false, results:[0,0,1] }));
  expect(readCardsSession('account-a')).toBeNull();
  expect(localStorage.getItem('tai.cards-session.v1.account-a')).toBeNull();
  saveCardsSession('account-a', { ids:['one'], index:1, revealed:false, results:[0,0,0] });
  expect(readCardsSession('account-a')).toBeNull();
});

it('elimina JSON truncado y no falla si el navegador bloquea el almacenamiento', () => {
  localStorage.setItem('tai.cards-session.v1.account-a', '{');
  expect(readCardsSession('account-a')).toBeNull();
  expect(localStorage.getItem('tai.cards-session.v1.account-a')).toBeNull();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage denied'); });
  expect(readCardsSession('account-a')).toBeNull();
});

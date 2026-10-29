import { configureBankAccessGate, loadBank } from '../../adapters/firebase/legacy-bank.js';
import { configureRemoteBankLoader } from '../../adapters/http/study-question-catalog.js';
import { isFull } from './access-composition.js';

/** Connects the optional authenticated bank source to the static HTTP fallback. */
export function configureBankSource(): void {
  configureBankAccessGate(isFull);
  configureRemoteBankLoader(loadBank);
}

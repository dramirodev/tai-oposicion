import { configureStudyBankAccessGate, loadStudyBank } from '../../adapters/firebase/study-bank-cache-source.js';
import { configureRemoteBankLoader } from '../../adapters/http/study-question-catalog.js';
import { isFull } from './access-composition.js';

/** Connects the optional authenticated bank source to the static HTTP fallback. */
export function configureBankSource(): void {
  configureStudyBankAccessGate(isFull);
  configureRemoteBankLoader(loadStudyBank);
}

import { configureBankAccessGate, loadBank } from '../../adapters/firebase/legacy-bank.js';
import { configureRemoteBankLoader } from '../../adapters/http/legacy-data.js';
import { isFull } from '../../adapters/legacy/access.js';

/** Connects the optional authenticated bank source to the static HTTP fallback. */
export function configureBankSource(): void {
  configureBankAccessGate(isFull);
  configureRemoteBankLoader(loadBank);
}

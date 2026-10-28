import { loadBank } from '../../adapters/firebase/legacy-bank.js';
import { configureRemoteBankLoader } from '../../adapters/http/legacy-data.js';

/** Connects the optional authenticated bank source to the static HTTP fallback. */
export function configureBankSource(): void {
  configureRemoteBankLoader(loadBank);
}

import { configureStudyBankAccessGate, loadStudyBank } from '../../adapters/firebase/study-bank-cache-source.js';
import { configureBankSample, configureRemoteBankLoader, fetchBankResponse } from '../../adapters/http/study-question-catalog.js';
import { configureOfflineFileFetcher } from '../../adapters/offline/cache.js';
import { isFull } from './access-composition.js';

/** Connects the authenticated bank source to the public sample and the offline downloader. */
export function configureBankSource(): void {
  configureStudyBankAccessGate(isFull);
  configureRemoteBankLoader(loadStudyBank);
  configureBankSample(() => !isFull());
  configureOfflineFileFetcher(fetchBankResponse);
}

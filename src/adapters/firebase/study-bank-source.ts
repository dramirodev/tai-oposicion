import { doc, getDoc, type Firestore } from 'firebase/firestore';

let database: Firestore | undefined;
let canReadBank: () => boolean = () => false;

export interface BankMeta { v: number; files: Record<string, string> }

/** Uses the authenticated Firestore connection configured by the sync adapter. */
export function configureStudyBankSource(firestore: Firestore, hasBankAccess: () => boolean): void {
  database = firestore;
  canReadBank = hasBankAccess;
}

/** Returns published bank hashes only for an authenticated, approved user. */
export async function bankMeta(): Promise<BankMeta | null> {
  if (!database || !canReadBank()) return null;
  try {
    const snapshot = await getDoc(doc(database, 'bank', 'meta'));
    const data = snapshot.exists() ? snapshot.data() : null;
    return data && data.files ? { v: data.v, files: data.files } as BankMeta : null;
  } catch { return null; }
}

/** Reads the gzip-compressed published bank file. */
export async function bankFile(name: string): Promise<Uint8Array | null> {
  if (!database || !canReadBank()) return null;
  try {
    const snapshot = await getDoc(doc(database, 'bank', `f_${name}`));
    const bytes = snapshot.exists() ? snapshot.data().z : null;
    return bytes && typeof bytes.toUint8Array === 'function' ? bytes.toUint8Array() : null;
  } catch { return null; }
}

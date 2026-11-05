/** Preparation only. Never import this module into the application bundle. */
import { readFile } from 'node:fs/promises';
export const PROJECT = 'demo-tai-auth';
export const identities = {
  owner: { uid:'tai-supertest', email:'tai-supertest@example.test' },
  normal: { uid:'tai-normal', email:'tai-normal@example.test' },
  restricted: { uid:'tai-restricted', email:'tai-restricted@example.test' },
  pending: { uid:'tai-pending', email:'tai-pending@example.test' },
};
export function assertEmulators(env = process.env) {
  if (env.GCLOUD_PROJECT !== PROJECT || env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
    || env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
    || (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== PROJECT)
    || env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_CONFIG && JSON.parse(env.FIREBASE_CONFIG).projectId !== PROJECT) {
    throw new Error('Synthetic users require only demo-tai-auth and fixed loopback emulators; credentials forbidden');
  }
}
export async function syntheticRules() {
  const rules = await readFile('firestore.rules', 'utf8');
  const anchor = /request\.auth\.token\.email == '[^']+'/g;
  if ([...rules.matchAll(anchor)].length !== 1) throw new Error('Unrecognized owner rule; refusing to modify');
  return rules.replace(anchor, `request.auth.token.email == '${identities.owner.email}'`);
}
export async function prepareSyntheticUsers() {
  assertEmulators();
  const [{ initializeApp, deleteApp }, { getAuth }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'), import('firebase-admin/auth'), import('firebase-admin/firestore'),
  ]);
  const app = initializeApp({ projectId:PROJECT }, `synthetic-${Date.now()}`);
  try {
    const auth = getAuth(app);
    const db = getFirestore(app);
    // Reset only the four reserved synthetic identities, including nested attempt events.
    for (const [role, identity] of Object.entries(identities)) {
      let existing = null;
      try { existing = await auth.getUserByEmail(identity.email); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      if (existing && existing.uid !== identity.uid) throw new Error(`Reserved synthetic email ${identity.email} belongs to unexpected UID ${existing.uid}`);
      if (role === 'owner') console.log(`[synthetic auth] ${identity.email}: ${existing ? 'exists; resetting reserved Emulator identity' : 'not found; creating reserved Emulator identity'}`);
      await db.recursiveDelete(db.doc(`users/${identity.uid}`));
      await db.doc(`access/${identity.uid}`).delete();
      await db.doc(`requests/${identity.uid}`).delete();
      try { await auth.deleteUser(identity.uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      await auth.createUser({ ...identity, emailVerified:true, displayName:`TAI synthetic ${role}` });
      if (role === 'normal') await db.doc(`access/${identity.uid}`).set({ ok:true, email:identity.email, name:'TAI normal', ts:Date.now() });
      if (role === 'pending') await db.doc(`requests/${identity.uid}`).set({ email:identity.email, name:'TAI pending', ts:Date.now() });
    }
  } finally { await deleteApp(app); }
}

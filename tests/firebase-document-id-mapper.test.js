import { describe, expect, it } from 'vitest';
import { decodeFirebaseDocumentId, encodeFirebaseDocumentId } from '../src/adapters/firebase/firebase-document-id-mapper.js';

describe('Firebase document ID mapper', () => {
  it('replaces dots when writing legacy question IDs to Firestore documents', () => {
    expect(encodeFirebaseDocumentId('T1.02-P4')).toBe('T1~02-P4');
  });

  it('restores dots when reading legacy question IDs from Firestore documents', () => {
    expect(decodeFirebaseDocumentId('T1~02-P4')).toBe('T1.02-P4');
  });

  it('leaves IDs without encoded characters unchanged', () => {
    expect(encodeFirebaseDocumentId('question-42')).toBe('question-42');
    expect(decodeFirebaseDocumentId('question-42')).toBe('question-42');
  });
});

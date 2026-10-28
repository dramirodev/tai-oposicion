/** Maps legacy question IDs to Firebase-safe document IDs and back. */
export function encodeFirebaseDocumentId(id: string): string {
  return id.replace(/\./g, '~');
}

export function decodeFirebaseDocumentId(id: string): string {
  return id.replace(/~/g, '.');
}

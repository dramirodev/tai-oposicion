/** Shape used by the historic question bank before it is mapped to domain questions. */
export interface QuestionRecord {
  i: string; t: string; o: 'O' | 'A' | 'G'; q: string; a: string[]; c: number;
  k?: string; x?: number[]; d?: number; n?: string; y?: string; u?: string; np?: number;
  source?: { url: string; title?: string; page?: number; verified: boolean };
  cp?: string; supTexto?: string; s?: unknown; p?: unknown; w?: unknown; v?: unknown;
}

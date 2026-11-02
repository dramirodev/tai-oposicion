/** Optional local PDF copy; its bytes never enter study progress or sync DTOs. */
export interface AcademyMaterialPdfCopy {
  topicId: string;
  materialPath: string;
  sourceHash: string;
  name: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  importedAt: number;
  pdfBytes: ArrayBuffer;
}

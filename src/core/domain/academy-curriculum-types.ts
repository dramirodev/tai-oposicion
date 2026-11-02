export interface AcademyCurriculumFile {
  path: string;
  name: string;
  kind: string;
  extension: string;
  sizeBytes: number;
  sha256?: string;
  outlineStatus?: string;
  outlineFingerprint?: string;
  outlineStructureFingerprint?: string;
  outlineEntryCount?: number;
}

export interface AcademyCurriculumSection {
  id: string;
  topicId: string;
  title: string;
  materialPath: string;
  printedPage: number;
  sourceOrdinal: number;
  sourceHash: string;
  materialKind: string;
  outlineFingerprint: string;
  outlineStructureFingerprint: string;
  verification: string;
}

export interface AcademyCurriculumTopic {
  id: string;
  name: string;
  folder: string;
  appCatalogMatch: boolean;
  appCatalogName?: string;
  sourceStatus: string;
  sourceFileCounts: Record<string, number>;
  files: AcademyCurriculumFile[];
  sections: AcademyCurriculumSection[];
}

/** Compact identity catalogue for checking saved progress without loading every topic module. */
export interface AcademyCurriculumMaterialIdentity {
  path: string;
  kind: string;
  sha256: string;
  outlineFingerprint: string;
  outlineStructureFingerprint: string;
}

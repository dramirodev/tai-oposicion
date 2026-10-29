import { mergePaperRecallAssessmentRecords, readPaperRecallAssessments, recordPaperRecallAssessment } from '../../../adapters/local/paper-recall-assessments.js';
import type { PaperRecallAssessment, PaperRecallRating } from '../../../core/domain/paper-recall-assessment.js';

export function createPaperRecallComposition(dependencies: {
  accountId(): string | null;
  now(): number;
  push?(assessments: readonly PaperRecallAssessment[]): void;
}) {
  const get = () => readPaperRecallAssessments(dependencies.accountId());
  return {
    get,
    mergeRemote(value: unknown): boolean {
      return Array.isArray(value) && mergePaperRecallAssessmentRecords(dependencies.accountId(), value);
    },
    record(topicId: string, rating: PaperRecallRating): PaperRecallAssessment | null {
      const assessment = recordPaperRecallAssessment(dependencies.accountId(), topicId, rating, dependencies.now());
      if (assessment) dependencies.push?.(get());
      return assessment;
    },
  };
}

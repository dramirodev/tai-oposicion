/** Structural format for catalog topic IDs; catalogue membership is validated by the caller. */
const studyTopicIdPattern = /^T[1-9]\d*\.\d{2}$/;

export function isStudyTopicId(value: unknown): value is string {
  return typeof value === 'string' && studyTopicIdPattern.test(value);
}

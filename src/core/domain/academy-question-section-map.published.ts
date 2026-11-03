import type { AcademyQuestionSectionManifest } from './academy-question-section-map.js';

/**
 * Shared, offline-capable editorial publication consumed by student features.
 * Update only from a human-reviewed owner export; local curator drafts are not
 * imported here automatically. The current publication intentionally has no links.
 */
export const publishedAcademyQuestionSectionManifest: AcademyQuestionSectionManifest = {
  schemaVersion: 2,
  revision: 'published-empty-2026-11-03',
  links: [],
};

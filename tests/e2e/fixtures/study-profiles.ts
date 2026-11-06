/** Local-only, versioned fixtures. Never import into the application bundle. */
export const STUDY_PROFILE_VERSION = 1;
export const STUDY_PROFILE_NOW = '2026-11-06T12:00:00+01:00';
export const studyProfiles = ['new', 'partial', 'extensive'] as const;
export type StudyProfile = (typeof studyProfiles)[number];

export function studyProfileFixture(profile: StudyProfile) {
  // 300 is the existing persisted history limit, not a new retention rule.
  const count = { new: 0, partial: 2, extensive: 300 }[profile];
  const anchor = Date.parse(STUDY_PROFILE_NOW);
  const sessions = Array.from({ length: count }, (_, index) => {
    const correct = 50 + (index % 31);
    return {
      id: `synthetic-v${STUDY_PROFILE_VERSION}-${profile}-${index}`,
      ts: anchor - (count - index) * 3_600_000,
      kind: 'sim',
      n: 100,
      a: correct,
      f: 0,
      b: 100 - correct,
      secs: 1800,
      nota: correct,
      titulo: 'Simulacro Parte 1',
      fails: [],
      temas: {},
      tipos: {},
    };
  }).reverse();
  return {
    stats: {},
    sessions,
    cfg: { ui: { theme: 'light', size: 1 } },
    seen: { t: [], ts: 0 },
    cards: {},
    reports: {},
  };
}

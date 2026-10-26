/** Canonical application paths. Hash routing adds the leading `#` in the URL. */
export const paths = {
  home: '/home',
  access: '/acceso',
  help: '/ayuda',
  topics: '/temario',
  quiz: '/quiz',
  result: '/result',
  test: '/test',
  simulation: '/sim',
  simulationReview: '/sim2',
  exams: '/examenes',
  cards: '/cards',
  stats: '/stats',
  settings: '/settings',
  failures: '/falladas',
  errors: '/errores',
  reading: '/lectura',
  lightning: '/relampago',
  traps: '/trampas',
} as const;

export const legacyPaths = [
  paths.quiz,
  paths.result,
  paths.test,
  paths.simulation,
  paths.simulationReview,
  paths.exams,
  paths.stats,
  paths.settings,
  paths.failures,
  paths.errors,
  paths.reading,
  paths.lightning,
  paths.traps,
] as const;

export function routeSegment(path: string): string {
  return path.replace(/^\//, '');
}

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

type PathName = keyof typeof paths;
type RouteSegment = typeof paths[PathName] extends `/${infer Segment}` ? Segment : never;
const segmentPaths = Object.fromEntries(
  Object.values(paths).map(path => [routeSegment(path), path]),
) as Record<RouteSegment, string>;

/** Resolve a route name used by navigation menus to its canonical app path. */
export function pathForSegment(segment: string): string {
  return segmentPaths[segment as RouteSegment] || `/${segment}`;
}

/** Build a hash URL from a canonical path name. */
export function hashPath(name: PathName): string {
  return `#${paths[name]}`;
}

/** Build a hash URL from a route name used in dynamic navigation. */
export function hashSegment(segment: string): string {
  return `#${pathForSegment(segment)}`;
}

export const legacyPaths = [
  paths.quiz,
  paths.result,
  paths.test,
  paths.simulation,
  paths.simulationReview,
  paths.exams,
  paths.cards,
  paths.stats,
  paths.settings,
  paths.failures,
  paths.reading,
  paths.lightning,
  paths.traps,
] as const;

export function routeSegment(path: string): string {
  return path.replace(/^\//, '');
}

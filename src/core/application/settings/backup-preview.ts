interface AttemptArchiveMapping<Archive extends { attempts: readonly unknown[] }> {
  toDomain(value: unknown):
    | { ok: true; value: { archive: Archive; invalidRecords: number } }
    | { ok: false; reason: string };
  toDto(value: Archive): unknown;
}

export interface BackupPreviewDependencies<Stat, Session, Card, Report, Archive extends { attempts: readonly unknown[] }> {
  cleanStats(value: unknown): Record<string, Stat>;
  cleanSessions(value: unknown): Session[];
  cleanCards(value: unknown): Record<string, Card>;
  cleanReports(value: unknown): Record<string, Report>;
  cleanSeen(value: unknown): unknown;
  cleanConfig(value: unknown): unknown;
  getStats(): Record<string, Stat>;
  getQuestionStats(id: string): Stat | null | undefined;
  needsSync(incoming: Stat, current: Stat): boolean;
  attemptArchive: AttemptArchiveMapping<Archive>;
}

const countItems = (amount: number, one: string, many: string) => `${amount} ${amount === 1 ? one : many}`;

/** Validates, normalizes and summarizes a backup without writing any local state. */
export function previewBackupImport<Stat, Session, Card, Report, Archive extends { attempts: readonly unknown[] }>(
  text: string,
  dependencies: BackupPreviewDependencies<Stat, Session, Card, Report, Archive>,
) {
  if (text.length > 20e6) throw new Error('Archivo no válido: supera 20 MB');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Archivo no válido: JSON ilegible'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Archivo no válido');
  const backup = raw as Record<string, unknown>;
  if (!backup.stats || typeof backup.stats !== 'object' || Array.isArray(backup.stats)) throw new Error('Archivo no válido');
  const rawStats = backup.stats as Record<string, unknown>;
  const stats = dependencies.cleanStats(rawStats), sessions = dependencies.cleanSessions(backup.sessions), cards = dependencies.cleanCards(backup.cards), reports = dependencies.cleanReports(backup.reports);
  let added = 0, updated = 0, preserved = 0;
  for (const id of Object.keys(stats)) {
    const old = dependencies.getQuestionStats(id);
    if (!old) added++;
    else if (dependencies.needsSync(stats[id], old)) updated++;
    else preserved++;
  }
  preserved += Object.keys(dependencies.getStats()).filter(id => !stats[id]).length;
  const ignored = Object.keys(rawStats).length - Object.keys(stats).length;
  let attemptArchive: Archive | undefined;
  let invalidAttempts = 0;
  if (backup.attemptHistory !== undefined) {
    const mapped = dependencies.attemptArchive.toDomain(backup.attemptHistory);
    if (!mapped.ok) throw new Error(`El historial de intentos de la copia no es válido: ${mapped.reason}`);
    attemptArchive = mapped.value.archive;
    invalidAttempts = mapped.value.invalidRecords;
  }
  const serialized = JSON.stringify({
    stats, sessions, cards, reports,
    ...(backup.seen ? { seen: dependencies.cleanSeen(backup.seen) } : {}),
    ...(backup.cfg ? { cfg: dependencies.cleanConfig(backup.cfg) } : {}),
    ...(attemptArchive ? { attemptHistory: dependencies.attemptArchive.toDto(attemptArchive) } : {}),
  });
  const summary = `${countItems(added, 'pregunta nueva', 'preguntas nuevas')}, ${countItems(updated, 'pregunta actualizada', 'preguntas actualizadas')} y ${countItems(preserved, 'pregunta conservada', 'preguntas conservadas')}. ${countItems(sessions.length, 'sesión válida', 'sesiones válidas')} y ${countItems(Object.keys(reports).length, 'aviso válido', 'avisos válidos')}. ${countItems(attemptArchive?.attempts.length || 0, 'intento detallado', 'intentos detallados')}. ${countItems(ignored + invalidAttempts, 'registro descartado por no ser válido', 'registros descartados por no ser válidos')}.${backup.cfg ? ' También se importarán los ajustes válidos de la copia.' : ''}`;
  return { summary, serialized, attemptArchive };
}

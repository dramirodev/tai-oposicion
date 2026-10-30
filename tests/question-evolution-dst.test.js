// @vitest-environment node
import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

/** Ejecuta buildQuestionEvolution con la zona horaria fijada: Vitest no fija TZ y el resultado depende de ella. */
function evolutionIn(timeZone, { now, weeks, startedAt }) {
  const output = execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--experimental-strip-types', '--input-type=module', '-e', `
    import { buildQuestionEvolution } from './src/core/domain/attempts/question-evolution.ts';
    const session = { id: 's', mode: 'practice', status: 'completed', startedAt: Date.parse(${JSON.stringify(startedAt)}), lastSequence: 0 };
    const attempt = { id: 'a', sessionId: 's', questionId: 'q', state: 'answered', outcome: 'correct' };
    const result = buildQuestionEvolution({ createdAt: 0, sessions: [session], attempts: [attempt], events: [] }, ${weeks}, Date.parse(${JSON.stringify(now)}));
    console.log(JSON.stringify(result.map(week => ({ hours: new Date(week.start).getHours(), minutes: new Date(week.start).getMinutes(), day: new Date(week.start).getDate(), seen: week.seen }))));
  `], { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' });
  return JSON.parse(output);
}

it('empieza cada semana en la medianoche local aunque haya un cambio de hora entre medias', () => {
  // El 25-oct-2026 Madrid pasa de +02:00 a +01:00: las semanas anteriores al cambio no deben quedar a la 01:00.
  const weeks = evolutionIn('Europe/Madrid', { now: '2026-10-27T12:00:00+01:00', weeks: 3, startedAt: '2026-10-27T12:00:00+01:00' });

  expect(weeks.map(week => [week.day, week.hours, week.minutes])).toEqual([[12, 0, 0], [19, 0, 0], [26, 0, 0]]);
});

it('cuenta en su semana una sesión de los primeros minutos del lunes anterior al cambio de hora', () => {
  const weeks = evolutionIn('Europe/Madrid', { now: '2026-10-27T12:00:00+01:00', weeks: 3, startedAt: '2026-10-12T00:30:00+02:00' });

  expect(weeks.map(week => week.seen)).toEqual([1, 0, 0]);
});

it('no desplaza una sesión del domingo por la noche a la semana siguiente tras el cambio de hora', () => {
  const weeks = evolutionIn('Europe/Madrid', { now: '2026-10-27T12:00:00+01:00', weeks: 3, startedAt: '2026-10-25T23:30:00+01:00' });

  expect(weeks.map(week => week.seen)).toEqual([0, 1, 0]);
});

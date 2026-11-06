import { simulationPace } from '../../core/domain/simulation-analysis.js';
import type { QuizPrompt, QuizSnapshot } from '../../shared/ui/study-services.js';

export function quizPageState(snapshot: QuizSnapshot, prompt: QuizPrompt, clock: number) {
  const revealed = quizIsRevealed(snapshot);
  const locked = snapshot.feedback
    ? snapshot.studyState === 'answered' || snapshot.studyState === 'revealed'
    : typeof snapshot.answer === 'number' && snapshot.answer >= 0;
  const readingGate = !prompt.nonScoring && snapshot.readingMode === 2 && !revealed && snapshot.answer === undefined && !snapshot.paused;
  const responseLocked = snapshot.feedback ? locked : typeof snapshot.answer === 'number' && snapshot.answer >= 0;
  const pace = snapshot.timeLimitSeconds && snapshot.timeLimitSeconds > 0
    ? simulationPace(snapshot.index, snapshot.count, snapshot.timeLimitSeconds, snapshot.seconds)
    : 0;
  return {
    revealed,
    responseLocked: prompt.nonScoring || responseLocked,
    gateRemaining: readingGate ? Math.max(0, Math.ceil((snapshot.readingGateUntil - clock) / 1000)) : 0,
    sourceLabel: prompt.origin === 'O' && prompt.year ? ` · ${prompt.year.replace('Ingreso libre ', '').replace('convocatoria ', '')}` : '',
    pace,
  };
}

export function quizIsRevealed(snapshot: QuizSnapshot | null | undefined) {
  return !!snapshot && snapshot.feedback && (snapshot.answer !== undefined || snapshot.studyState === 'revealed');
}

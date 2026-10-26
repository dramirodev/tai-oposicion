import { HelpIconLink } from '../../shared/ui/HelpIconLink.js';
import { NativeDialog } from '../../shared/ui/NativeDialog.js';
import type { RefObject } from 'react';
import type { QuizSnapshot } from '../../shared/ui/study-services.js';

export function QuizSessionHeader({ snapshot, pace, headingRef, onExit, onPause }: { snapshot: QuizSnapshot; pace: number; headingRef: RefObject<HTMLHeadingElement | null>; onExit: () => void; onPause: () => void }) {
  const progress = snapshot.timed && snapshot.timeLimitSeconds
    ? Math.min(100, 100 * snapshot.seconds / snapshot.timeLimitSeconds)
    : 100 * snapshot.index / snapshot.count;
  const paceStatus = pace >= 0 ? 'up' : pace > -3 ? 'mid' : 'low';
  const paceText = pace > 0 ? `${pace} por delante` : pace < 0 ? `${-pace} por detrás` : 'al día';
  return <>
    <h1 ref={headingRef} className="sr">{snapshot.title} · pregunta {snapshot.index + 1}{snapshot.timed ? '' : ` de ${snapshot.count}`}</h1>
    <div className="qhead">
      <button className="ghost" id="exit" aria-label="Salir" onClick={onExit}>✕</button>
      <div className="prog"><div style={{ width: `${progress}%` }} /></div>
      <div className="cnt">{snapshot.timed ? `#${snapshot.index + 1}` : `${snapshot.index + 1}/${snapshot.count}`}</div>
      {snapshot.timeLimitSeconds !== null && <>
        <div className="clock" id="clock">{formatTime(snapshot.remainingSeconds)}</div>
        <button className="ghost" id="pause" aria-label="Pausar" onClick={onPause}>⏸</button>
      </>}
    </div>
    <div className="sub study-run-title">{snapshot.title} <HelpIconLink topic="sesiones" label="Ayuda sobre controles y estados de pregunta" /></div>
    {snapshot.timeLimitSeconds !== null && <div className={`pace ${paceStatus}`} id="pace">Ritmo: {paceText} · {Math.round(snapshot.timeLimitSeconds / snapshot.count)} s por pregunta</div>}
  </>;
}

export function QuizPauseDialog({ paused, onResume }: { paused: boolean; onResume: () => void }) {
  return <NativeDialog open={paused} className="pause-modal" labelledBy="pt" initialFocusSelector="#resume" onCancel={onResume}>
    <div className="card"><h2 id="pt">En pausa</h2><p>El tiempo está detenido.</p><button className="btn" id="resume" onClick={onResume}>Continuar</button></div>
  </NativeDialog>;
}

function formatTime(seconds: number | null) {
  const remaining = Math.max(0, seconds || 0);
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
}

import { Pause, X } from 'lucide-react';
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
    <div className="qhead sticky top-[calc(var(--sat)/var(--z,1))] z-[3] mb-4 flex items-center gap-4 border-b-0 bg-canvas py-3">
      <button className="ghost h-12 w-12 flex-none rounded-[var(--r-m)] border border-line bg-[var(--card)] p-0 text-[length:var(--fs-xl)] text-ink" id="exit" aria-label="Salir" onClick={onExit}><X size="1.25rem" aria-hidden="true" /></button>
      <div className="prog min-w-0 h-[.375rem] flex-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-[var(--selb)] origin-left animate-[grow_.45s_cubic-bezier(.2,.7,.2,1)]" style={{ width: `${progress}%` }} /></div>
      <div className="cnt min-w-11 text-right text-[length:var(--fs-m)] font-semibold text-muted">{snapshot.timed ? `#${snapshot.index + 1}` : `${snapshot.index + 1}/${snapshot.count}`}</div>
      {snapshot.timeLimitSeconds !== null && <>
        <div className="clock rounded-[var(--r-s)] bg-[var(--sel)] px-[.5625rem] py-1 font-semibold text-[length:var(--fs-b)] [font-family:var(--font-ui)] [font-variant-numeric:tabular-nums]" id="clock">{formatTime(snapshot.remainingSeconds)}</div>
        <button className="ghost" id="pause" aria-label="Pausar" onClick={onPause}><Pause size="1.25rem" aria-hidden="true" /></button>
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

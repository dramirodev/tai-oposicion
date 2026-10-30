interface StudyProgressBarProps {
  percent: number;
  trackClassName?: string;
  fillClassName?: string;
  valueNow?: number;
  valueMax?: number;
  label?: string;
}

const defaultFillClassName = 'h-full bg-[var(--selb)] origin-left animate-[grow_.45s_cubic-bezier(.2,.7,.2,1)]';

/** Shared horizontal study progress bar; session-specific values stay with the caller. */
export function StudyProgressBar({ percent, trackClassName = 'prog', fillClassName = defaultFillClassName, valueNow, valueMax, label = 'Progreso' }: StudyProgressBarProps) {
  const accessible = valueNow !== undefined && valueMax !== undefined;
  return <div
    className={trackClassName}
    role={accessible ? 'progressbar' : undefined}
    aria-label={accessible ? label : undefined}
    aria-valuemin={accessible ? 0 : undefined}
    aria-valuemax={accessible ? valueMax : undefined}
    aria-valuenow={accessible ? valueNow : undefined}
  ><div className={fillClassName} style={{ width: `${percent}%` }} /></div>;
}

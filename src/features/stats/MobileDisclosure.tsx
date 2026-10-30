import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';

const mobileQuery = '(max-width: 40rem)';

function isExpandedByDefault(): boolean {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function' || !window.matchMedia(mobileQuery).matches;
}

export function MobileDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(isExpandedByDefault);

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const update = () => setExpanded(!media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, []);

  const onToggle = (event: SyntheticEvent<HTMLDetailsElement>) => setExpanded(event.currentTarget.open);
  return <details className="mobile-progress-disclosure my-4" open={expanded} onToggle={onToggle}>
    <summary className="flex min-h-11 items-center justify-between gap-3 border-b border-line py-2 text-ink text-[length:var(--fs-l)] font-semibold cursor-pointer list-none min-[40.01rem]:hidden [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-[var(--selb)] focus-visible:outline-offset-2">
      <span>{title}</span><span aria-hidden="true" className="text-muted text-[length:var(--fs-xl)] font-normal">{expanded ? '−' : '+'}</span>
    </summary>
    {children}
  </details>;
}

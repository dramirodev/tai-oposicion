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
  return <details className="mobile-progress-disclosure" open={expanded} onToggle={onToggle}>
    <summary>{title}</summary>
    {children}
  </details>;
}

/** Animate visible sections once; never hide content while waiting for JavaScript. */
export function observeScrollSections(root: HTMLElement): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let stop = () => {};
  const start = () => {
    stop();
    if (preference.matches) return;
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (!entry.target.matches(':focus-within')) entry.target.classList.add('scroll-enter');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08 });
    const scan = () => root.querySelectorAll('section, .topic-block, .strategy-segment').forEach(section => {
      if (seen.has(section)) return;
      seen.add(section);
      observer.observe(section);
    });
    const changes = new MutationObserver(scan);
    changes.observe(root, { childList: true, subtree: true });
    scan();
    stop = () => { observer.disconnect(); changes.disconnect(); root.querySelectorAll('.scroll-enter').forEach(section => section.classList.remove('scroll-enter')); };
  };
  start();
  preference.addEventListener?.('change', start);
  return () => { stop(); preference.removeEventListener?.('change', start); };
}

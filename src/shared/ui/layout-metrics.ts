/** Fixed actions live inside the zoomed app; navigation is a portal outside it.
 * Keep physical heights in one place so text, wrapping and safe areas determine
 * the reserved space. ResizeObserver reads are batched before style writes.
 */
export function observeFixedLayout(): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const root = document.documentElement;
  let frame = 0;
  let observed = new Set<Element>();
  const measure = () => {
    frame = 0;
    const nav = document.querySelector('nav[aria-label="Principal"]');
    const bars = [...document.querySelectorAll<HTMLElement>('#app .bar2')];
    const targets = new Set<Element>([...(nav ? [nav] : []), ...bars]);
    for (const element of observed) if (!targets.has(element)) resize.unobserve(element);
    for (const element of targets) if (!observed.has(element)) resize.observe(element);
    observed = targets;
    const navigationHeight = nav?.getBoundingClientRect().height ?? 0;
    const actionsHeight = Math.max(0, ...bars.map(bar => bar.getBoundingClientRect().height));
    for (const [name, value] of [['--navigation-height', navigationHeight], ['--actions-height', actionsHeight]] as const) {
      const next = `${value.toFixed(2)}px`;
      if (root.style.getPropertyValue(name) !== next) root.style.setProperty(name, next);
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const resize = new ResizeObserver(schedule);
  const affectsFixedLayout = (node: Node) => node instanceof Element && (
    node.matches('.bar2,nav[aria-label="Principal"]') || node.querySelector('.bar2,nav[aria-label="Principal"]')
  );
  const mutations = new MutationObserver(records => {
    // Clock ticks and unrelated text updates must not cause layout reads.
    if (records.some(record => record.type === 'attributes' ||
      [...record.addedNodes, ...record.removedNodes].some(affectsFixedLayout))) schedule();
  });
  mutations.observe(document.body, { childList: true, subtree: true });
  mutations.observe(root, { attributes: true, attributeFilter: ['data-text-size'] });
  window.addEventListener('resize', schedule);
  measure();
  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
    window.removeEventListener('resize', schedule);
    root.style.removeProperty('--navigation-height');
    root.style.removeProperty('--actions-height');
  };
}

import { useLayoutEffect } from 'react';
import { useStudyService } from './study-services.js';
/** Called only once content is ready, so async screens receive keyboard focus. */
export function usePageReady(ready: boolean) {
  const markReady = useStudyService('markReady');
  useLayoutEffect(() => {
    if (!ready) return;
    const heading = document.querySelector<HTMLElement>('#app h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    markReady?.();
  }, [ready, markReady]);
}

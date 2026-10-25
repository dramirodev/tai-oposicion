const ACCESS_CHANGE = 'tai:access-change';

export function notifyAccessChange(): void {
  window.dispatchEvent(new Event(ACCESS_CHANGE));
}

export function subscribeAccessChanges(fn: () => void): () => void {
  window.addEventListener(ACCESS_CHANGE, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(ACCESS_CHANGE, fn);
    window.removeEventListener('storage', fn);
  };
}

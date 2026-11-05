import { afterEach, expect, it, vi } from 'vitest';
import { bootAppServices } from '../src/app/app-bootstrap.js';

afterEach(() => vi.useRealTimers());

it('starts app lifecycle work after the first route and cleans up listeners and timers', async () => {
  vi.useFakeTimers();
  const events = [];
  let resolveAccess;
  const dependencies = {
    onAccountChange: listener => { events.push(listener); return vi.fn(); },
    goHome: vi.fn(), recover: vi.fn(async () => {}),
    setAttemptTrackingVisible: vi.fn(), flushStore: vi.fn(), flushAttemptTracking: vi.fn(),
    onAccessResolved: listener => { resolveAccess = listener; return vi.fn(); },
    saveRun: vi.fn(), pauseTrainingSession: vi.fn(), routeReady: Promise.resolve(), resumeSaved: vi.fn(), prefetchBank: vi.fn(),
    checkUpdate: vi.fn(async () => ({ version: '1.2.0' })), announceUpdate: vi.fn(),
    loadMetadataAndInitializeSync: vi.fn(async () => {}),
  };
  const stop = bootAppServices(dependencies);
  await vi.advanceTimersByTimeAsync(0);

  expect(dependencies.recover).toHaveBeenCalledOnce();
  expect(dependencies.resumeSaved).not.toHaveBeenCalled();
  resolveAccess();
  expect(dependencies.resumeSaved).toHaveBeenCalledOnce();
  expect(dependencies.loadMetadataAndInitializeSync).toHaveBeenCalledOnce();
  events[0]();
  expect(dependencies.goHome).toHaveBeenCalledOnce();

  let documentVisibility = 'hidden';
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => documentVisibility);
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pagehide'));
  expect(dependencies.setAttemptTrackingVisible).toHaveBeenLastCalledWith(false);
  expect(dependencies.flushStore).toHaveBeenCalledTimes(2);
  expect(dependencies.flushAttemptTracking).toHaveBeenCalledTimes(2);
  expect(dependencies.pauseTrainingSession).toHaveBeenCalledTimes(2);
  expect(dependencies.saveRun).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(4000);
  expect(dependencies.prefetchBank).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(2000);
  expect(dependencies.checkUpdate).not.toHaveBeenCalled();
  documentVisibility = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  expect(dependencies.checkUpdate).not.toHaveBeenCalled();
  stop();
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pagehide'));
  await vi.advanceTimersByTimeAsync(10000);
  expect(dependencies.flushStore).toHaveBeenCalledTimes(2);
  expect(dependencies.prefetchBank).toHaveBeenCalledOnce();
  expect(dependencies.checkUpdate).not.toHaveBeenCalled();
  visibility.mockRestore();
});

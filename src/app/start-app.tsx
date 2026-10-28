import './legacy-ui.js';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App.js';
import { initializeApp, shutdownApp } from './router/route-runtime.js';
import { initializeAttemptTracking } from './composition/attempts/attempt-tracking-composition.js';

initializeAttemptTracking();
initializeApp();
const root = createRoot(document.getElementById('app')!);
root.render(<StrictMode><App /></StrictMode>);

export function unmountApp(): void {
  root.unmount();
  shutdownApp();
}

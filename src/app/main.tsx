import '../shared/styles/index.css';
import './legacy-ui.js';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App, initializeApp, shutdownApp } from './App.js';
import { initializeAttemptTracking } from './attempt-tracking.js';
initializeAttemptTracking();
initializeApp();
export const root = createRoot(document.getElementById('app')!);
root.render(<StrictMode><App /></StrictMode>);
export function unmountApp(): void {
  root.unmount();
  shutdownApp();
}

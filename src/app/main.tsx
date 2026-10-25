import './legacy-ui.js';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App, initializeApp, shutdownApp } from './App.js';
initializeApp();
export const root = createRoot(document.getElementById('app')!);
root.render(<StrictMode><App /></StrictMode>);
export function unmountApp(): void {
  root.unmount();
  shutdownApp();
}

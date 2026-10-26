import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppServicesProvider } from '../src/shared/ui/study-services.tsx';
vi.mock('../src/shared/ui/dialog-actions.js', () => ({ ask: vi.fn(async () => true), toast: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root, account, settings;
const snapshot = () => ({ sync: { state: 'sin sesión', user: null, configured: false, lastSync: 0, error: '', detail: '', host: '', authDomain: '', accessError: '', requests: [] }, full: false, level: 'invitado', devMode: null, devRevealed: false, ui: { theme: 'auto', size: 0, lectura: 0 }, progress: { questions: 0, topics: 0, sessions: 0, openReports: 0 }, exam: '', version: '1.1.3', build: 'test', update: null, offline: null, index: null });
function createSettings() { return {
 accountId: () => account, getSnapshot: snapshot, subscribe: () => () => {}, load: async () => {},
 setPreference: vi.fn(), setExam: vi.fn(), setDevMode: vi.fn(), revealDev: vi.fn(), requestAccess: vi.fn(async () => true), login: vi.fn(), logout: vi.fn(), retrySync: vi.fn(),
 checkUpdate: vi.fn(async () => null), applyUpdate: vi.fn(), downloadOffline: vi.fn(async () => ({ complete: true, missing: [], total: 0, completedAt: null })),
 exportAnki: vi.fn(async () => ''), exportBackup: vi.fn(async () => ''), previewBackup: vi.fn(() => ({ summary: '1 pregunta nueva', serialized: '{"stats":{"nuevo":[1,1,200]}}' })),
 importBackup: vi.fn(async () => {}), resetAll: vi.fn(), findAiSessions: vi.fn(async () => []), buildAiExport: vi.fn(async () => ({})), deleteAiHistory: vi.fn(async () => ({ accountSyncPending: false })),
}; }
async function renderSettings() {
 const { SettingsPage } = await import('../src/features/settings/SettingsPage.js');
 host = document.createElement('div'); document.body.append(host); root = createRoot(host);
 await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(AppServicesProvider, { value: { settings } }, React.createElement(SettingsPage)))));
 await act(async () => Promise.resolve());
}
beforeEach(() => { account = 'cuenta-a'; settings = createSettings(); document.body.innerHTML = ''; });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; host?.remove(); vi.clearAllMocks(); });
it('presenta ajustes por secciones y persiste los cambios de apariencia', async () => {
 await renderSettings();
 expect(host.querySelector('h1')?.textContent).toBe('Ajustes');
 expect(host.querySelector('[aria-label="Tema"]')).not.toBeNull();
 expect(host.querySelector('details')?.textContent).toContain('Diagnóstico técnico');
 expect(host.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
 const light = [...host.querySelectorAll('[aria-label="Tema"] button')].find(button => button.textContent === 'Claro');
 await act(async () => light.click()); expect(settings.setPreference).toHaveBeenCalledWith('theme', 'light');
});
it('confirma antes de combinar una copia y muestra el resultado', async () => {
 const { ask } = await import('../src/shared/ui/dialog-actions.js'); await renderSettings();
 const input = host.querySelector('input[type="file"]');
 Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 2, text: async () => '{}' }] });
 await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 0)); });
 expect(ask).toHaveBeenCalled();
 expect(settings.importBackup).toHaveBeenCalledWith('{"stats":{"nuevo":[1,1,200]}}', undefined);
 expect(host.textContent).toContain('Copia combinada: 1 pregunta nueva');
});
it('no aplica una copia si la cuenta cambia durante la confirmación', async () => {
 const { ask } = await import('../src/shared/ui/dialog-actions.js'); let confirm;
 ask.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; })); await renderSettings();
 const input = host.querySelector('input[type="file"]');
 Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 2, text: async () => '{}' }] });
 await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 0)); });
 account = 'cuenta-b';
 await act(async () => { confirm(true); await new Promise(resolve => setTimeout(resolve, 0)); });
 expect(settings.importBackup).not.toHaveBeenCalled();
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_TRAINING_PREFERENCES } from '../src/core/domain/study-training-plan.js';
vi.mock('../src/shared/ui/dialog-actions.js', () => ({ ask: vi.fn(async () => true), toast: vi.fn() }));
let account, settings, view, fullAccess, trainingState;
const subscribers = new Set();
const snapshot = () => ({ sync: { state: 'sin sesión', user: null, configured: false, lastSync: 0, error: '', detail: '', host: '', authDomain: '', accessError: '', requests: [] }, full: fullAccess, level: fullAccess ? 'propietario' : 'invitado', devMode: null, devRevealed: false, ui: { theme: 'auto', size: 0, lectura: 0 }, training: trainingState, progress: { questions: 0, topics: 0, sessions: 0, openReports: 0 }, exam: '', version: '1.1.3', build: 'test', update: null, offline: null, index: null });
function createSettings() { return {
 accountId: () => account, getSnapshot: snapshot, subscribe: listener => { subscribers.add(listener); return () => subscribers.delete(listener); }, load: async () => {},
 setPreference: vi.fn(), setTrainingPreferences: vi.fn(value => { trainingState = value; subscribers.forEach(listener => listener()); }), createTrainingCalendarEvent: vi.fn(input => ({ ...input, id:'event-test', createdAt:1, updatedAt:1 })), setExam: vi.fn(), setDevMode: vi.fn(), revealDev: vi.fn(), requestAccess: vi.fn(async () => true), login: vi.fn(), logout: vi.fn(), retrySync: vi.fn(),
 checkUpdate: vi.fn(async () => null), applyUpdate: vi.fn(), downloadOffline: vi.fn(async () => ({ complete: true, missing: [], total: 0, completedAt: null })),
 exportAnki: vi.fn(async () => ''), exportBackup: vi.fn(async () => ''), previewBackup: vi.fn(() => ({ summary: '1 pregunta nueva', serialized: '{"stats":{"nuevo":[1,1,200]}}' })),
 importBackup: vi.fn(async () => {}), resetAll: vi.fn(), findAiSessions: vi.fn(async () => []), buildAiExport: vi.fn(async () => ({})), deleteAiHistory: vi.fn(async () => ({ accountSyncPending: false })),
}; }
async function renderSettings() {
 const { SettingsPage } = await import('../src/features/settings/SettingsPage.js');
 view = renderApp(createElement(SettingsPage), { services: { settings } });
 await screen.findByRole('heading', { name: 'Ajustes' });
}
beforeEach(() => { account = 'cuenta-a'; fullAccess = false; trainingState = DEFAULT_TRAINING_PREFERENCES; subscribers.clear(); settings = createSettings(); });
afterEach(() => { view?.unmount(); view = undefined; subscribers.clear(); vi.clearAllMocks(); });
it('presenta ajustes por secciones y persiste los cambios de apariencia', async () => {
 const user = userEvent.setup();
 await renderSettings();
 expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument();
 expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
 expect(screen.getByText('Diagnóstico técnico')).toBeInTheDocument();
 expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
 await user.click(screen.getByRole('button', { name: 'Claro' })); expect(settings.setPreference).toHaveBeenCalledWith('theme', 'light');
});
it('expone la versión visible completa en el nombre accesible del control de versión', async () => {
 await renderSettings();
 expect(screen.getByRole('button', { name: 'Versión 1.1.3 (test)' })).toBeInTheDocument();
});
it('distingue la última sincronización correcta de un error posterior', async () => {
 fullAccess = true;
 settings.getSnapshot = () => ({ ...snapshot(), sync:{ state:'sincronizado', user:{ name:'A', email:'a@example.test' }, configured:true, lastSync:Date.now(), error:'No se pudo guardar en la nube (permission-denied)', detail:'', host:'', authDomain:'', accessError:'', requests:[] } });
 await renderSettings();
 expect(screen.getByText(/último dato recibido/)).toBeInTheDocument();
 expect(screen.getByText(/Datos recibidos/)).toBeInTheDocument();
 expect(screen.getByText(/permission-denied/)).toBeInTheDocument();
 await userEvent.setup().click(screen.getByRole('button', { name:'Reintentar sincronización' }));
 expect(settings.retrySync).toHaveBeenCalledOnce();
});
it('permite editar el presupuesto semanal y las modalidades del entrenador', async () => {
 fullAccess = true;
 const user = userEvent.setup();
 await renderSettings();
 const sundayMinutes = screen.getByRole('spinbutton', { name: 'Domingo: minutos de entrenamiento' });
 fireEvent.change(sundayMinutes, { target: { value: '25' } });
 expect(settings.setTrainingPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ minutesByDay: [25, 120, 120, 120, 120, 120, 120], activityVersion: 3 }));
 await user.click(screen.getByRole('checkbox', { name: 'Active Recall con tarjetas' }));
 expect(settings.setTrainingPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ activities: ['newContent', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews'], activityVersion: 3, minutesByDay:[25,120,120,120,120,120,120] }));
});
it('permite asignar el tema nuevo de la semana en los ajustes', async () => {
 fullAccess = true;
 settings.getSnapshot = () => ({ ...snapshot(), index: { questions: 10, scenarios: 0, topics: [{ id: 'T3.02', name: 'Tribunal Constitucional' }] } });
 const user = userEvent.setup(); await renderSettings();
 await user.selectOptions(screen.getByRole('combobox', { name: 'Tema que estás introduciendo esta semana' }), 'T3.02');
 expect(settings.setTrainingPreferences).toHaveBeenCalledWith(expect.objectContaining({ introductionTopicId: 'T3.02' }));
});
it('permite configurar, reordenar y quitar temas sin inferir el orden del catálogo', async () => {
 fullAccess = true;
 settings.getSnapshot = () => ({ ...snapshot(), index: { questions: 10, scenarios: 0, topics: [{ id: 'T3.02', name: 'Tema B' }, { id: 'T12.01', name: 'Tema A' }] } });
 const user = userEvent.setup(); await renderSettings();
 const select = screen.getByRole('combobox', { name: 'Añadir tema al final' });
 await user.selectOptions(select, 'T3.02'); await user.click(screen.getByRole('button', { name: 'Añadir' }));
 expect(settings.setTrainingPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ academyTopicOrderIds: ['T3.02'] }));
 await user.selectOptions(select, 'T12.01'); await user.click(screen.getByRole('button', { name: 'Añadir' }));
 expect(settings.setTrainingPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ academyTopicOrderIds: ['T3.02', 'T12.01'] }));
 await user.click(screen.getByRole('button', { name: 'Subir T12.01' }));
 expect(settings.setTrainingPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ academyTopicOrderIds: ['T12.01', 'T3.02'] }));
 await user.click(screen.getByRole('button', { name: 'Quitar T12.01' }));
 expect(settings.setTrainingPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ academyTopicOrderIds: ['T3.02'] }));
});
it('permite registrar una ventana especial de vacaciones sin cambiar el patrón semanal', async () => {
 fullAccess = true;
 const user = userEvent.setup(); await renderSettings();
 await user.selectOptions(screen.getByRole('combobox', { name:'Tipo de evento' }), 'study-window');
 fireEvent.change(screen.getByLabelText('Nombre del evento'), { target:{ value:'Vacaciones' } });
 fireEvent.change(screen.getByLabelText('Inicio del evento'), { target:{ value:'2026-11-02' } });
 fireEvent.change(screen.getByLabelText('Hasta (incluido)'), { target:{ value:'2026-11-05' } });
 fireEvent.change(screen.getByRole('spinbutton', { name:'Minutos de estudio enfocado' }), { target:{ value:'240' } });
 await user.click(screen.getByRole('button', { name:'Guardar evento' }));
 expect(settings.setTrainingPreferences).toHaveBeenLastCalledWith(expect.objectContaining({
   minutesByDay:DEFAULT_TRAINING_PREFERENCES.minutesByDay,
   calendarEvents:[expect.objectContaining({ kind:'study-window', title:'Vacaciones', startDate:'2026-11-02', endDate:'2026-11-05', studyMinutes:240, startTime:'08:00', endTime:'15:00' })],
 }));
 expect(screen.getByText('Vacaciones').closest('li')).toHaveTextContent('2026-11-02 a 2026-11-05');
 expect(screen.getByText('Vacaciones').closest('li')).toHaveTextContent('240 min de estudio · 08:00–15:00 · En curso');
});
it('confirma antes de combinar una copia y muestra el resultado', async () => {
 const { ask } = await import('../src/shared/ui/dialog-actions.js'); await renderSettings();
 const input = screen.getByLabelText('Importar');
 Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 2, text: async () => '{}' }] });
 fireEvent.change(input);
 await vi.waitFor(() => expect(ask).toHaveBeenCalled());
 await vi.waitFor(() => expect(settings.importBackup).toHaveBeenCalled());
 expect(settings.importBackup).toHaveBeenCalledWith('{"stats":{"nuevo":[1,1,200]}}', undefined);
 expect(await screen.findByText(/Copia combinada: 1 pregunta nueva/)).toBeInTheDocument();
});
it('no aplica una copia si la cuenta cambia durante la confirmación', async () => {
 const { ask } = await import('../src/shared/ui/dialog-actions.js'); let confirm;
 ask.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; })); await renderSettings();
 const input = screen.getByLabelText('Importar');
 Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 2, text: async () => '{}' }] });
 fireEvent.change(input);
 await vi.waitFor(() => expect(confirm).toBeTypeOf('function'));
 account = 'cuenta-b';
 confirm(true);
 await screen.findByRole('heading', { name: 'Ajustes' });
 expect(settings.importBackup).not.toHaveBeenCalled();
});

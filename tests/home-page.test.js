import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { AppServicesProvider } from '../src/shared/ui/study-services.tsx';
import { HomePage } from '../src/features/home/HomePage.tsx';
let root;
afterEach(async () => { if (root) await act(() => root.unmount()); document.body.replaceChildren(); });
it('keeps guest quick-session actions single-flight and hides restricted training', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let finish;
  const quickSession = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const services = { home: {
    accountId: () => null, subscribe: () => () => {}, getActiveStudy: () => null,
    getAccess: () => ({ full: false, level: 'invitado', greeting: 'Hola', state: 'sin sesión', configured: false, signedIn: false, pendingRequests: 0 }),
    loadOverview: async () => ({ completedSessions:0,blocks:[], seen:0,total:100,answers:0,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0 }), quickSession,
  }};
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(AppServicesProvider, {value:services}, createElement(HomePage)))));
  expect(host.querySelector('#test')).toBeNull();
  expect(host.querySelector('.home-domain')).toBeNull();
  expect(host.querySelector('.home-metrics').textContent).toContain('Sesiones completadas0');
  expect(host.querySelector('#guest').textContent).toContain('Sesión sin iniciar');
  const button=host.querySelector('#quick');
  await act(() => {button.click();button.click();});
  expect(quickSession).toHaveBeenCalledTimes(1);expect(button.disabled).toBe(true);
  await act(async () => finish());expect(button.disabled).toBe(false);
});
it('shows the domain summary when every assessed topic is still yellow', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const services = { home: {
    accountId: () => null, subscribe: () => () => {}, getActiveStudy: () => null,
    getAccess: () => ({ full: true, level: 'propietario', greeting: 'Hola', state: 'sincronizado', configured: true, signedIn: true, pendingRequests: 0 }),
    loadOverview: async () => ({ completedSessions:0,blocks:[{ name: 'Bloque I', total:11, assessed:2, mastered:0 }], seen:1,total:100,answers:4,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0,assessedTopics:2 }), quickSession: async () => {},
  }};
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(AppServicesProvider, {value:services}, createElement(HomePage)))));
  expect(host.querySelector('#mapa small').textContent).toBe('0 por reforzar · 0 dominados');
  expect(host.querySelector('.home-block').textContent).toBe('Bloque I0 de 11 dominados');
  expect(host.querySelector('.home-metrics').textContent).toContain('Preguntas vistas1 / 100');
});

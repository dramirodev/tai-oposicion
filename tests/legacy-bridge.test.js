import { it, expect, vi } from 'vitest';
it('aísla el DOM y la limpieza de una ruta pendiente después de desmontarla', async () => {
  document.body.innerHTML = '<main id="app"></main>';
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const ui = await import('../src/vistas/ui.js');
  const old = document.createElement('div'); document.querySelector('#app').append(old);
  const dispose = ui.bindLegacyHost(old);
  const scope = ui.legacyScope(); const off = vi.fn(); scope.screen.cleanup = off;
  dispose(); expect(off).toHaveBeenCalledTimes(1); old.remove();
  const next = document.createElement('div'); next.innerHTML = '<h1 id="next">Destino</h1>'; document.querySelector('#app').append(next);
  const disposeNext = ui.bindLegacyHost(next);
  scope.app.innerHTML = '<h1 id="late">Carga anterior</h1>';
  expect(document.querySelector('#app').textContent).toBe('Destino');
  expect(scope.$('#next')).toBeNull();
  const lateOff = vi.fn(); scope.screen.cleanup = lateOff; expect(lateOff).toHaveBeenCalledOnce();
  disposeNext(); dispose(); expect(off).toHaveBeenCalledOnce();
});

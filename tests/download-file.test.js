import { afterEach, expect, it, vi } from 'vitest';
import { saveExportFile } from '../src/shared/ui/download-file.js';
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('mantiene el archivo durante la descarga y libera su URL después', () => {
  vi.useFakeTimers();
  const createObjectURL = vi.fn(() => 'blob:backup');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  let link;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { link = this; expect(this.isConnected).toBe(true); });
  saveExportFile('copia.json', '{"stats":{}}', 'application/json');
  expect(link.download).toBe('copia.json');
  expect(link.isConnected).toBe(false);
  expect(createObjectURL.mock.calls[0][0].type).toBe('application/json');
  expect(revokeObjectURL).not.toHaveBeenCalled();
  vi.advanceTimersByTime(30_000);
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:backup');
});
it('también limpia el enlace y la URL si el navegador rechaza el clic', () => {
  vi.useFakeTimers();
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:failed', revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('fallo'); });
  expect(() => saveExportFile('copia.json', '{}', 'application/json')).toThrow('fallo');
  expect(document.querySelector('a[download="copia.json"]')).toBeNull();
  vi.advanceTimersByTime(30_000);
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:failed');
});

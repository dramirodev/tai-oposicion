import { VISUAL_THEMES, normalizeVisualTheme } from '../../shared/presentation/visual-themes.js';

export function VisualThemeSelector({ value, onChange }: { value?: string; onChange(value: string): void }) {
  const selected = normalizeVisualTheme(value);
  return <fieldset className="visual-theme-selector min-w-0 border-0 p-0">
    <legend className="mb-3 font-medium">Tema visual</legend>
    <div className="grid grid-cols-1 gap-3 min-[600px]:grid-cols-2">
      {VISUAL_THEMES.map(theme => <label key={theme.id} className="theme-choice" data-selected={selected === theme.id}>
        <input type="radio" name="visual-theme" value={theme.id} checked={selected === theme.id} onChange={() => onChange(theme.id)} />
        <span className="min-w-0"><span className="theme-swatch" data-preview={theme.id} aria-hidden="true"><span /><span /><span /></span>
          <span className="block font-semibold">{theme.name}</span><span className="block text-sm text-muted">{theme.description}</span>
        </span>
      </label>)}
    </div>
    <p className="text-sm text-muted" role="status">Tema aplicado: {VISUAL_THEMES.find(theme => theme.id === selected)?.name}. Se guarda automáticamente en este dispositivo para la cuenta actual.</p>
  </fieldset>;
}

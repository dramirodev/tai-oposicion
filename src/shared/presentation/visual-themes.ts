/** Stable local preference IDs; color mode remains an independent preference. */
export const VISUAL_THEMES = [
  { id: 'soft-brutalism', name: 'Neobrutalismo suave', description: 'Bordes definidos y acción en amarillo.' },
  { id: 'living-notebook', name: 'Cuaderno vivo', description: 'Títulos editoriales y superficies cálidas.' },
  { id: 'momentum', name: 'Impulso', description: 'Formas suaves y acción en violeta.' },
  { id: 'tai-lab', name: 'Laboratorio TAI', description: 'Líneas precisas y acento técnico.' },
  { id: 'classic', name: 'Clásico', description: 'La identidad sobria de TAI.' },
] as const;
export type VisualTheme = typeof VISUAL_THEMES[number]['id'];
export const DEFAULT_VISUAL_THEME: VisualTheme = 'soft-brutalism';
export function normalizeVisualTheme(value: unknown): VisualTheme {
  // Precisión was the previous visual identity, separate from light/dark.
  if (value === 'precision') return 'classic';
  return VISUAL_THEMES.find(theme => theme.id === value)?.id ?? DEFAULT_VISUAL_THEME;
}

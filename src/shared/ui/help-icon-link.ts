import { hashPath } from '../navigation/paths.js';

export type HelpTopic = 'sesiones' | 'motivos' | 'puntuacion' | 'simulacros' | 'repaso' | 'progreso';

const attributeEscapes: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function helpIconLink(topic: HelpTopic, label: string): string {
  const accessibleLabel = label.replace(/[&<>"']/g, character => attributeEscapes[character]);
  return `<a class="help-icon-link" href="${hashPath('help')}?tema=${encodeURIComponent(topic)}" aria-label="${accessibleLabel}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3 2.5V14M12 17h.01"/></svg></a>`;
}

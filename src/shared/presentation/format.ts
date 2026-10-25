export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export function formatTime(seconds: number): string {
  seconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return (hours ? hours + ':' : '') + String(minutes).padStart(hours ? 2 : 1, '0') + ':' + String(remainder).padStart(2, '0');
}

export function percentage(numerator: number, denominator: number): number {
  return denominator ? Math.round(100 * numerator / denominator) : 0;
}

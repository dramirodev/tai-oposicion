import type { QuestionEvolutionWeek } from '../../core/domain/attempts/question-evolution.js';

type SeriesKey = 'seen' | 'correct' | 'wrong' | 'unknown';
const series: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'seen', label: 'Vistas', color: 'var(--selb)' },
  { key: 'correct', label: 'Acertadas', color: 'var(--good-ink)' },
  { key: 'wrong', label: 'Falladas', color: 'var(--r-ink)' },
  { key: 'unknown', label: 'No lo sé', color: 'var(--mute)' },
];
const dateLabel = (time: number) => new Date(time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const html = (tag: string, className?: string, text?: string) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const svg = (tag: string) => document.createElementNS('http://www.w3.org/2000/svg', tag);

export function mountQuestionEvolution(root: HTMLElement, weeks: readonly QuestionEvolutionWeek[]): void {
  const card = html('div', 'card');
  root.replaceChildren(card);
  if (!weeks.some(week => week.seen > 0)) {
    card.append(html('p', 'sub', 'Aún no hay sesiones completadas con historial detallado en este periodo. Los registros antiguos no se reconstruyen.'));
    return;
  }

  const width = 440, height = 210, left = 38, right = 12, top = 14, bottom = 30;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maxValue = Math.max(1, ...weeks.map(week => week.seen));
  const max = Math.ceil(maxValue / 5) * 5 || 1;
  const x = (index: number) => left + (weeks.length === 1 ? plotWidth / 2 : plotWidth * index / (weeks.length - 1));
  const y = (value: number) => top + plotHeight * (1 - value / max);
  const chart = svg('svg');
  chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', 'Evolución semanal de preguntas vistas, acertadas, falladas y marcadas como no lo sé');
  for (const fraction of [0, 0.5, 1]) {
    const line = svg('line');
    line.setAttribute('x1', String(left)); line.setAttribute('x2', String(width - right));
    line.setAttribute('y1', String(y(max * fraction))); line.setAttribute('y2', String(y(max * fraction)));
    line.setAttribute('class', 'gl'); chart.append(line);
    const label = svg('text');
    label.setAttribute('x', String(left - 6)); label.setAttribute('y', String(y(max * fraction) + 4));
    label.setAttribute('text-anchor', 'end'); label.setAttribute('class', 'gt');
    label.textContent = String(Math.round(max * fraction)); chart.append(label);
  }
  for (const item of series) {
    const line = svg('polyline');
    line.setAttribute('points', weeks.map((week, index) => `${x(index)},${y(week[item.key])}`).join(' '));
    line.setAttribute('fill', 'none'); line.setAttribute('stroke', item.color);
    line.setAttribute('stroke-width', '2'); line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('stroke-linecap', 'round'); chart.append(line);
    weeks.forEach((week, index) => {
      const dot = svg('circle');
      dot.setAttribute('cx', String(x(index))); dot.setAttribute('cy', String(y(week[item.key])));
      dot.setAttribute('r', '2.5'); dot.setAttribute('fill', item.color);
      const title = svg('title');
      title.textContent = `Semana del ${dateLabel(week.start)}: ${item.label.toLowerCase()} ${week[item.key]}`;
      dot.append(title); chart.append(dot);
    });
  }
  const step = Math.max(1, Math.ceil(weeks.length / 6));
  weeks.forEach((week, index) => {
    if (index % step !== 0 && index !== weeks.length - 1) return;
    const label = svg('text');
    label.setAttribute('x', String(x(index))); label.setAttribute('y', String(height - 5));
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'gt');
    label.textContent = dateLabel(week.start); chart.append(label);
  });
  const chartWrap = html('div', 'evo'); chartWrap.append(chart); card.append(chartWrap);

  const legend = html('div', 'evolution-legend');
  for (const item of series) {
    const key = html('span', 'evolution-key'), swatch = html('i');
    swatch.setAttribute('aria-hidden', 'true'); swatch.style.background = item.color;
    key.append(swatch, document.createTextNode(item.label)); legend.append(key);
  }
  card.append(legend, html('p', 'legend', 'Cuenta preguntas vistas en sesiones completadas desde que se activó el historial detallado. Las sesiones antiguas no tienen datos por pregunta.'));

  const table = html('table', 'tb'), caption = html('caption', undefined, 'Preguntas por semana');
  const head = document.createElement('thead'), headerRow = document.createElement('tr');
  for (const label of ['Semana', 'Vistas', 'Acertadas', 'Falladas', 'No lo sé']) {
    const cell = html('th', undefined, label) as HTMLTableCellElement; cell.scope = 'col'; headerRow.append(cell);
  }
  head.append(headerRow); table.append(caption, head);
  const body = document.createElement('tbody');
  for (const week of weeks.filter(item => item.seen > 0)) {
    const row = document.createElement('tr');
    for (const value of [dateLabel(week.start), week.seen, week.correct, week.wrong, week.unknown]) row.append(html('td', undefined, String(value)));
    body.append(row);
  }
  table.append(body);
  const tableWrap = html('div', 'table-scroll');
  tableWrap.setAttribute('role', 'region'); tableWrap.setAttribute('aria-label', 'Datos semanales de evolución'); tableWrap.tabIndex = 0;
  tableWrap.append(table); card.append(tableWrap);
}

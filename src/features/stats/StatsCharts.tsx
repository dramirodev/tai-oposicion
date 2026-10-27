import type { CSSProperties } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TrendPoint {
  timestamp: number;
  value: number | null;
}

export interface QuestionEvolutionPoint {
  start: number;
  seen: number;
  correct: number;
  wrong: number;
  unknown: number;
}

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const tooltipStyle: CSSProperties = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-s)',
  color: 'var(--ink)',
  fontSize: 'var(--fs-s)',
};
const tooltipLabelStyle: CSSProperties = { color: 'var(--ink)', fontWeight: 600 };
const axisTick = { fill: 'var(--mute)', fontSize: 'var(--fs-xs)' };

export function StatsTrendChart({
  points,
  label,
  metric,
  suffix = '',
  emptyMessage,
}: {
  points: readonly TrendPoint[];
  label: string;
  metric: string;
  suffix?: string;
  emptyMessage: string;
}) {
  const data = points.map((point, index) => ({ ...point, position: points.length === 1 ? 0.5 : index }));
  const hasValues = data.some(point => point.value !== null);
  if (!hasValues) return <p className="sub chart-empty">{emptyMessage}</p>;

  const tickInterval = Math.max(0, Math.ceil(data.length / 6) - 1);
  const valueLabel = (value: unknown) => {
    const number = Number(value);
    const rounded = Number.isInteger(number) ? String(number) : number.toFixed(1);
    return `${rounded}${suffix}`;
  };
  return <div className="stats-chart" role="group" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        accessibilityLayer
        title={label}
        desc={`${label}. Usa las flechas izquierda y derecha para consultar los puntos; los mismos datos también aparecen en el listado de esta sección.`}
        margin={{ top: 10, right: 24, bottom: 4, left: 0 }}
      >
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="position"
          type="number"
          domain={[0, Math.max(1, data.length - 1)]}
          allowDecimals={false}
          interval={tickInterval}
          tickFormatter={position => formatDate(data[Math.round(Number(position))]?.timestamp || 0)}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          minTickGap={12}
        />
        <YAxis
          width={42}
          domain={[0, maximum => maximum + Math.max(1, maximum * 0.1)]}
          tickFormatter={valueLabel}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: 'var(--line)', strokeDasharray: '3 3' }}
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={position => {
            const point = data[Math.round(Number(position))];
            return point ? formatDate(point.timestamp) : '';
          }}
          formatter={value => [valueLabel(value), metric]}
        />
        <Line
          dataKey="value"
          name={metric}
          type="linear"
          stroke="var(--selb)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'var(--selb)', stroke: 'var(--card)', strokeWidth: 2 }}
          activeDot={{ r: 5, fill: 'var(--selb)', stroke: 'var(--card)', strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

const evolutionSeries = [
  { key: 'seen', label: 'Vistas', color: 'var(--selb)' },
  { key: 'correct', label: 'Acertadas', color: 'var(--good-ink)' },
  { key: 'wrong', label: 'Falladas', color: 'var(--r-ink)' },
  { key: 'unknown', label: 'No lo sé', color: 'var(--mute)' },
] as const;

export function QuestionEvolutionChart({ weeks }: { weeks: readonly QuestionEvolutionPoint[] }) {
  const data = weeks.map((week, index) => ({ ...week, position: index }));
  const tickInterval = Math.max(0, Math.ceil(data.length / 6) - 1);
  return <>
    <div className="stats-chart stats-chart--evolution" role="group" aria-label="Evolución semanal de preguntas vistas, acertadas, falladas y marcadas como no lo sé">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          accessibilityLayer
          title="Evolución semanal de preguntas"
          desc="Preguntas vistas, acertadas, falladas y marcadas como no lo sé por semana. Usa las flechas izquierda y derecha para consultar los puntos; la tabla siguiente contiene los mismos datos."
          margin={{ top: 10, right: 24, bottom: 4, left: 0 }}
        >
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="position"
            type="number"
            domain={[0, Math.max(1, data.length - 1)]}
            allowDecimals={false}
            interval={tickInterval}
            tickFormatter={position => formatDate(data[Math.round(Number(position))]?.start || 0)}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            minTickGap={12}
          />
          <YAxis width={38} domain={[0, maximum => maximum + Math.max(1, maximum * 0.1)]} tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: 'var(--line)', strokeDasharray: '3 3' }}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            labelFormatter={position => {
              const week = data[Math.round(Number(position))];
              return week ? `Semana del ${formatDate(week.start)}` : '';
            }}
          />
          {evolutionSeries.map(series => <Line
            key={series.key}
            dataKey={series.key}
            name={series.label}
            type="linear"
            stroke={series.color}
            strokeWidth={2}
            dot={{ r: 2.5, fill: series.color, stroke: 'var(--card)', strokeWidth: 1.5 }}
            activeDot={{ r: 4, fill: series.color, stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
          />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="evolution-legend">{evolutionSeries.map(series => <span className="evolution-key" key={series.key}><i style={{ backgroundColor: series.color }} />{series.label}</span>)}</div>
    <p className="legend">El historial detallado está disponible desde que se activó esta función; sesiones anteriores no se reconstruyen.</p>
  </>;
}

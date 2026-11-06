import { useEffect, useRef, useState } from 'react';
import type { MetricsQuery } from '../../core/application/stats/metrics-query.js';
import type { StatsServices } from '../../shared/ui/study-services.js';

type Coverage = Awaited<ReturnType<NonNullable<StatsServices['loadCatalogueCoverage']>>>;
export function CatalogueCoverage({ stats, query, practicedIds }: { stats: StatsServices; query: MetricsQuery; practicedIds: readonly string[] }) {
  const [value, setValue] = useState<Coverage | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  if (!stats.loadCatalogueCoverage) return null;
  const load = async () => {
    const account = stats.accountId?.();
    setBusy(true); setError('');
    try {
      const result = await stats.loadCatalogueCoverage!(query, practicedIds);
      if (active.current && account === stats.accountId?.()) setValue(result);
    } catch { if (active.current) setError('No se pudo comprobar el catálogo elegible; no se representa como cobertura cero.'); }
    finally { if (active.current) setBusy(false); }
  };
  return <section aria-label="Cobertura comprobada del banco"><h3>Cobertura del banco y de vinculación</h3>
    <p>La comprobación carga bajo demanda el banco disponible y aplica las mismas exclusiones que la práctica o el simulacro. El periodo afecta a las preguntas practicadas; el denominador es el catálogo actual de esos temas y orígenes. Los supuestos externos a este índice no forman parte del denominador.</p>
    <button type="button" className="btn sec" disabled={busy} onClick={() => void load()}>{busy ? 'Comprobando catálogo…' : value ? 'Actualizar cobertura comprobada' : 'Comprobar cobertura elegible'}</button>
    {error && <p role="alert">{error}</p>}
    {value && <>
      <p>{value.practiced} / {value.eligible} preguntas elegibles practicadas ({value.percent === null ? 'Sin catálogo elegible' : `${value.percent.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`}). Revisión de catálogo: {value.revision}.</p>
      <p>{value.approvedLinks ?? 0} / {value.eligible} con vinculación aprobada vigente ({value.approvedPercent === null || value.approvedPercent === undefined ? 'sin denominador' : `${value.approvedPercent.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`}). {value.staleLinks ?? 0} vínculos obsoletos o sin revisión semántica verificable. {Math.max(0, value.eligible - (value.approvedLinks ?? 0))} sin clasificación aprobada vigente. Publicación: {value.manifestRevision ?? 'no disponible'}.</p>
      <p className="legend">Practicar preguntas y disponer de vínculos editoriales son coberturas diferentes; ninguna demuestra dominio del temario. Los borradores y propuestas no cuentan como aprobaciones.</p>
    </>}
  </section>;
}

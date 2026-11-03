import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { saveExportFile } from '../../shared/ui/download-file.js';
import { useStudyService, type ReportedQuestion } from '../../shared/ui/study-services.js';
import { selectErrorReports } from './errors-controller.js';
import { PageLoading } from '../../shared/ui/PageLoading.js';

const FILTERS = [['abierto', 'Por revisar'], ['resuelto', 'Resueltos'], ['todos', 'Todos']] as const;

export function ErrorsPage() {
  const errors = useStudyService('errors');
  const [, setRevision] = useState(0);
  const [content, setContent] = useState<{ questions: Map<string, ReportedQuestion>; cardReportIds: Set<string> }>({ questions: new Map(), cardReportIds: new Set() });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');
  useEffect(() => errors.subscribe(() => setRevision(value => value + 1)), [errors]);

  const filter = errors.getFilter();
  const all = errors.getReports();
  const reports = selectErrorReports(all, filter);
  const reportKey = all.map(report => report.id).join('|');
  const loading = loadedKey !== reportKey;
  useEffect(() => {
    let active = true;
    void errors.loadContent(reportKey ? reportKey.split('|') : []).then(value => {
      if (active) {
        setContent({ questions: new Map(value.questions.map(question => [question.id, question])), cardReportIds: new Set(value.cards.map(card => card.id)) });
        setFailedKey(null);
      }
    }).catch(() => {
      if (active) { setContent({ questions: new Map(), cardReportIds: new Set() }); setFailedKey(reportKey); }
    }).finally(() => { if (active) setLoadedKey(reportKey); });
    return () => { active = false; };
  }, [errors, reportKey]);

  const activeReports = selectErrorReports(all, 'todos');
  const openCount = activeReports.filter(report => report.state === 'abierto').length;
  const exportReports = async () => {
    try { saveExportFile('errores-banco.json', await errors.exportData(), 'application/json'); setExportError(''); }
    catch { setExportError('No se pudieron preparar los avisos para exportar. Comprueba la conexión e inténtalo de nuevo.'); }
  };

  return <>
    <h1>Errores del banco</h1>
    <p className="sub">{openCount} por revisar · {activeReports.length - openCount} resueltos. Las preguntas que marcas con «Avisar de error» llegan aquí.</p>
    <div className="seg" aria-label="Filtrar avisos">{FILTERS.map(([value, label]) => <button key={value} className={filter === value ? 'on' : ''} aria-pressed={filter === value} onClick={() => errors.setFilter(value)}>{label}</button>)}</div>
    <div className="row"><button className="btn sec" onClick={() => void exportReports()} disabled={!activeReports.length}>Exportar para corregir</button></div>
    {exportError && <p role="alert" className="r">{exportError}</p>}
    {loading ? <PageLoading variant="content" /> : reports.length === 0 ? <div className="card"><p className="sub">Nada en esta lista.</p></div> : reports.map(report => {
      const question = content.questions.get(report.id), isHiddenContentReport = content.cardReportIds.has(report.id);
      return <article className="card" key={report.id}>
        <div className="meta"><span className="tag">{report.id}</span>{question?.origin && <span className="tag">{question.origin}</span>}<span className="tag warn">{report.motivo || 'Otro'}</span>{report.state === 'resuelto' && <span className="tag oG">Resuelto</span>}</div>
        {report.nota && <p className="sm"><b>Nota:</b> {report.nota}</p>}
        {isHiddenContentReport ? <p className="sub">El contenido asociado a este aviso ya no se muestra aquí.</p>
          : question ? <><div className="pre sm">{question.statement}</div>{question.options.map(option => <div className={`mt-1 rounded-[var(--r-s)] px-2 py-1.5 ${option.correct ? 'bg-[var(--okbg)]' : ''}`} key={`${question.id}-${option.label}`}><b>{option.label}</b> {option.text}{option.correct && <> <Check size="1em" aria-label="Respuesta correcta" /></>}</div>)}{question.reference && <div className="cita"><span>Temario</span>{question.reference}</div>}</>
            : <p className="sub">{failedKey === reportKey ? 'No se pudo cargar el contenido del aviso. Comprueba la conexión e inténtalo de nuevo.' : 'La pregunta ya no está en el banco.'}</p>}
        <div className="row"><button className="btn sec" onClick={() => errors.setState(report.id, report.state === 'resuelto' ? 'abierto' : 'resuelto')}>{report.state === 'resuelto' ? 'Reabrir' : 'Marcar resuelto'}</button><button className="btn sec" onClick={() => errors.setState(report.id, 'quitado')}>Quitar</button></div>
      </article>;
    })}
  </>;
}

import { useEffect, useState } from 'react';
import { FREE_ENTRY_2025_EXAM as profile, OFFICIAL_2025_EVIDENCE, type OfficialExamRun, type OfficialScenarioId } from '../../core/domain/simulation-scenarios.js';
import { useStudyService } from '../../shared/ui/study-services.js';

export function OfficialExamForm({ starting, onBegin }: {
  starting: boolean;
  onBegin: (scenario: OfficialScenarioId, quota: OfficialExamRun['quota']) => void;
}) {
  const simulation = useStudyService('simulation');
  const [choices, setChoices] = useState<Awaited<ReturnType<typeof simulation.loadOfficialChoices>> | null>(null);
  const [deadline, setDeadline] = useState<number | null>(() => simulation.getOfficialDeadline());
  const [clockError, setClockError] = useState(false);
  const [scenario, setScenario] = useState<OfficialScenarioId>();
  const [quota, setQuota] = useState<OfficialExamRun['quota']>('general');
  useEffect(() => {
    let active = true;
    void simulation.loadOfficialChoices().then(rows => { if (active) setChoices(rows); }).catch(() => { if (active) setChoices([]); });
    return () => { active = false; };
  }, [simulation]);
  return <section className="card">
    <h2 className="h3">Ingreso libre 2025 · Modelo A</h2>
    <p>{profile.maxTheoryQuestions} preguntas de conocimientos y {profile.practicalQuestions} de un supuesto. Dispones de {profile.totalMinutes} minutos en total desde que abras el cuaderno, incluida la lectura de los dos supuestos. Puedes moverte entre ambas partes. El reloj sigue corriendo si cierras la aplicación.</p>
    <p>La plantilla definitiva sustituye la pregunta 20 de conocimientos por la primera reserva. Cada error resta un tercio y las respuestas en blanco valen cero.</p>
    <label>Baremo de calificación<select value={quota} onChange={event => setQuota(event.target.value === 'norma13' ? 'norma13' : 'general')}>
      <option value="general">Sistema general</option><option value="norma13">Cupo de la norma común 13</option>
    </select></label>
    <p>Mínimos directos: 24 de 80 en conocimientos y {quota === 'general' ? '9,67' : '6'} de 20 en el supuesto. Necesitas 25 de 50 puntos transformados en cada parte. <a href={OFFICIAL_2025_EVIDENCE.cutoffs}>Cortes publicados por la CPS</a></p>
    {choices === null ? <p role="status">Cargando los dos supuestos…</p> : choices.length !== 2 ? <p role="status">El cuaderno completo no está disponible para esta cuenta.</p> :
      !deadline ? <button className="btn" onClick={() => { const limit = simulation.openOfficialBooklet(); setDeadline(limit); setClockError(!limit); }}>Abrir cuaderno e iniciar los 120 minutos</button> :
      <fieldset><legend>Elige un supuesto</legend>{choices.map(choice => <div key={choice.id}>
        <label><input type="radio" name="official-scenario" checked={scenario === choice.id} onChange={() => setScenario(choice.id)} /> Bloque {choice.id === 'L2025A-S1' ? 'III · Desarrollo de sistemas' : 'IV · Sistemas y comunicaciones'}</label>
        <details><summary>Leer enunciado del bloque {choice.id === 'L2025A-S1' ? 'III' : 'IV'}</summary><div className="pre sm">{choice.text}</div></details>
      </div>)}</fieldset>}
    {clockError && <p role="alert">Activa el almacenamiento local para conservar el plazo del examen.</p>}
    {deadline && <p>Hora límite: {new Date(deadline).toLocaleTimeString('es-ES')}. Elige un único bloque para responder.</p>}
    {deadline && <button className="btn" disabled={starting || !scenario || choices?.length !== 2} onClick={() => { if (deadline <= Date.now()) { setDeadline(null); setScenario(undefined); } else if (scenario) onBegin(scenario, quota); }}>{starting ? 'Preparando…' : 'Responder el examen'}</button>}
    <p className="sub sm"><a href={profile.sourceUrl}>Bases, anexo V</a> · <a href={OFFICIAL_2025_EVIDENCE.key}>Plantilla definitiva</a> · <a href={OFFICIAL_2025_EVIDENCE.transformation}>Fórmula de calificación</a></p>
  </section>;
}

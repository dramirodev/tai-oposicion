import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStudyServices, type ScenarioChoice } from '../../shared/ui/study-services.js';

export function SimulationReviewPage() {
  const { simulationReview } = useStudyServices();
  const navigate = useNavigate();
  const [choices, setChoices] = useState<readonly ScenarioChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void simulationReview.loadChoices().then(result => { if (active) { setChoices(result); setLoading(false); } }).catch(() => { if (active) { setMessage('No se pudieron cargar los supuestos. Comprueba la conexión e inténtalo de nuevo.'); setLoading(false); } });
    return () => { active = false; };
  }, [simulationReview]);

  return <>
    <h1>Parte 2 · Supuesto práctico</h1>
    <div className="note">Elige uno de los supuestos. Son ejercicios reales de convocatorias anteriores.</div>
    {loading && <p className="sub loading" role="status">Buscando supuestos disponibles…</p>}
    {!loading && choices.map((choice, index) => <section className="card" key={choice.id}>
      <h2 className="h3">Supuesto {index + 1}</h2>
      <div className="pre sm">{choice.text}</div>
      <button className="btn" onClick={() => { const result = simulationReview.start(choice.id); if (result === 'unavailable') setMessage('Ese supuesto ya no está disponible para esta cuenta. Vuelve al simulacro e inténtalo de nuevo.'); }}>Elegir este supuesto</button>
    </section>)}
    {!loading && !choices.length && !message && <p className="card">No hay supuestos disponibles ahora.</p>}
    <div className="bar2"><button className="btn sec" onClick={() => navigate('/home')}>Saltar la parte 2</button></div>
    {message && <p className="card" role="alert">{message}</p>}
  </>;
}

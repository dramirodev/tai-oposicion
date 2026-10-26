import { useEffect } from 'react';
import { useStudyServices } from '../shared/ui/study-services.js';

export function ExamsRedirect() {
  const { simulation } = useStudyServices();
  useEffect(() => simulation.openExams(), [simulation]);
  return <p className="sub loading" role="status">Abriendo simulacros por examen…</p>;
}

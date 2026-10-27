import { useEffect } from 'react';
import { useStudyService } from '../shared/ui/study-services.js';

export function ExamsRedirect() {
  const simulation = useStudyService('simulation');
  useEffect(() => simulation.openExams(), [simulation]);
  return <p className="sub loading" role="status">Abriendo simulacros por examen…</p>;
}

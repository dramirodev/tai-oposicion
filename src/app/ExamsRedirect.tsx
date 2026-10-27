import { useEffect } from 'react';
import { useStudyService } from '../shared/ui/study-services.js';
import { PageLoading } from '../shared/ui/PageLoading.js';

export function ExamsRedirect() {
  const simulation = useStudyService('simulation');
  useEffect(() => simulation.openExams(), [simulation]);
  return <PageLoading variant="content" />;
}

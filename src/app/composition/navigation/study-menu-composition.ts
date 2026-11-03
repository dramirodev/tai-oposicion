import type { MenuGroup } from '../../../shared/ui/dialog-store.js';
import { hashPath } from '../../../shared/navigation/paths.js';
import { APP_VERSION } from '../../build-info.js';
import { menuActionIcons, navigationIcons } from '../../navigation-icons.js';

export interface StudyMenuInput {
  fullAccess: boolean;
  owner: boolean;
  pendingQuestions: number;
  readingSpeedFailures: number;
  openReports: number;
  seenTopics: number;
  failedQuestions: number;
  accessRequests: number;
  updateAvailable: boolean;
  actions: { quickSession(): void; startReview(): void };
}

/** Builds the shared navigation menu from already loaded account and study summaries. */
export function createStudyMenuGroups(input: StudyMenuInput): MenuGroup[] {
  const study: MenuGroup = ['Estudiar', [
    [menuActionIcons.quick, 'Sesión rápida', '10 preguntas en unos 5 minutos', input.actions.quickSession],
    [menuActionIcons.review, 'Repaso de fallos', input.pendingQuestions ? `${input.pendingQuestions} ${input.pendingQuestions === 1 ? 'pregunta toca repasar hoy' : 'preguntas toca repasar hoy'}` : 'Nada pendiente hoy', input.actions.startReview],
    [navigationIcons.test, 'Test por tema', '10–40 preguntas con corrección inmediata', hashPath('test')],
    [navigationIcons.sim, 'Simulacros', 'Completo, por examen o por tema', hashPath('simulation')],
  ]];
  const habits: MenuGroup = ['Entrenar un hábito', [
    [navigationIcons.traps, 'Detective de trampas', 'Marca qué trampas esconde cada pregunta', hashPath('traps')],
    [navigationIcons.reading, 'Lectura atenta', input.readingSpeedFailures ? `${input.readingSpeedFailures} fallos por velocidad` : 'Qué piden, palabras clave y respuesta', hashPath('reading')],
    [navigationIcons.lightning, 'Pregunta relámpago', 'Una sola pregunta', hashPath('lightning')],
  ]];
  const tracking: MenuGroup = ['Seguimiento', [
    [navigationIcons.planning, 'Planificación de estudio', 'Sesión de hoy y calendario semanal', hashPath('planning')],
    [navigationIcons.stats, 'Progreso', 'Mapa de dominio, simulacros y evolución', hashPath('stats')],
    [navigationIcons.topics, 'Temas vistos', `${input.seenTopics} temas marcados`, hashPath('topics')],
    [navigationIcons.failures, 'Preguntas falladas', `${input.failedQuestions} para buscar y releer`, hashPath('failures')],
    [menuActionIcons.errors, 'Errores del banco', input.openReports ? `${input.openReports} por revisar` : 'Nada por revisar', hashPath('errors')],
  ]];
  const appItems: MenuGroup[1] = [
    [navigationIcons.home, 'Inicio', 'Resumen y cuenta atrás', hashPath('home')],
    [navigationIcons.settings, 'Ajustes', input.updateAvailable ? 'Hay una versión nueva' : `Cuenta, apariencia, copia y versión ${APP_VERSION}`, hashPath('settings')],
    [navigationIcons.help, 'Ayuda', 'Motivos, práctica, simulacros y guardado', hashPath('help')],
  ];
  if (input.owner) appItems.splice(1, 0, [navigationIcons.access, 'Accesos', input.accessRequests ? `${input.accessRequests} solicitudes por revisar` : 'Quién puede usar la app', hashPath('access')]);
  const app: MenuGroup = ['La app', appItems];
  return input.fullAccess ? [study, habits, tracking, app] : [['Estudiar', [study[1][0]]], app];
}
